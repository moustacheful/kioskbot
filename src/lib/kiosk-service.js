import _ from 'lodash';
import redis from './redis';
import googleSheet from 'src/lib/google-sheet';
import uuid from 'uuid';

class KioskService {
	constructor(){
		googleSheet.on('stockUpdated', this.updateStock.bind(this));
	}

	async getStock(){
		const keys = await redis.smembersAsync('in-stock');
		const operations = _.map(keys, key => ['hgetall', key]);

		return await redis.multi(operations).execAsync();
	}

	async updateStock(newStock, revisionData) {
		const isUpToDate = await this.isUpToDate(revisionData)
		//if (isUpToDate) return console.log('Is up to date!');
		const operations = _.map(newStock, row => ['hmset', `inventory:${row.slug}`, row]);

		await redis.multi(operations).execAsync();
		await this.updateAvailableList();
	}

	async updateAvailableList(){
		const keys = await redis.keysAsync('inventory:*');
		let operations = _.map(keys, key => ['hgetall', key]);
		const products = await redis.multi(operations).execAsync();

		const inStock = _.reduce(products, (accumulator, product) => {
			if(product.stock_actual > 0){
				accumulator.push(`inventory:${product.slug}`);
			}

			return accumulator;
		},[]);

		operations = [];
		operations.push(['del','in-stock'])
		operations.push(['sadd','in-stock', inStock]);

		return redis.multi(operations).execAsync();
	}

	async purchase(productSlug, purchaser, quantity = 1){
		if (!purchaser) throw new Error('No purchaser.');

		const productKey = `inventory:${_.kebabCase(productSlug)}`;
		const product = await redis.hgetallAsync(productKey);

		if (!product) throw new Error('Product not available.');
		if (product.stock_actual < 1) throw new Error('Product out of stock.');

		const operations = [
			['hincrby', productKey, 'stock_actual', -1],
			['hincrby', 'tab', purchaser, product.precio],
			['hmset', `purchase:${uuid.v4()}`, {
				productKey,
				quantity,
				user: purchaser,
				timestamp: Date.now()
			}],
		];

		const [stockLeft, debt, purchase] = await redis.multi(operations).execAsync();
		
		// Exec async tasks.
		this.updateAvailableList();
		googleSheet.update(product.index, 2, stockLeft);

		return { 
			debt,
			product: await redis.hgetallAsync(productKey)
		};
	}

	async isUpToDate(incoming) {
		const lastRevision = await redis.hgetallAsync('app:last-revision');
		if (lastRevision && incoming.id === lastRevision.id){
			return true;
		}
		incoming.lastModifyingUser = incoming.lastModifyingUser.displayName;
		await redis.hmset('app:last-revision', incoming);
		
		return false;
	}
}

export default new KioskService();