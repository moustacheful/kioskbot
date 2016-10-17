import _ from 'lodash';
import Promise from 'bluebird';
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
		if (isUpToDate) return console.log('Is up to date!');
		
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

	async purchase(productSlug, user, quantity = 1){
		if (!user) throw new Error('No user specified.');

		const productKey = `inventory:${_.kebabCase(productSlug)}`;
		const product = await redis.hgetallAsync(productKey);

		if (!product) throw new Error('Product not available.');
		if (product.stock_actual < 1) throw new Error('Product out of stock.');

		const operations = [
			['hincrby', productKey, 'stock_actual', -1],
			['hincrby', 'tab', user.id, product.precio],
			['hmset', `purchase:${uuid.v4()}`, {
				productKey,
				quantity,
				user: user.id,
				timestamp: Date.now()
			}],
			['hset', 'users', user.id, user.name],
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

	async payTabForUser (name, amount) {
		const tabs = await this.getTabs();
		const tab = _.find(tabs, { name });

		if (!tab) throw new Error(`Usuario ${name} no existe en los registros.`);
		if (tab.amount - amount < 0) throw new Error(`Monto sobrepasa la deuda. _(hint: dejar vacío para pagar todo)_`);
		if (!amount) amount = tab.amount;
		const remainder = await redis.hincrbyAsync('tab', tab.id, -amount);

		return { ...tab, paid: amount, remainder };
	}

	async getTabByName (name) {
		const tabs = await this.getTabs();
		return _.find(tabs, { name });
	}
	
	async getTabById (userId) {
		return Promise.props({
			name: redis.hgetAsync('users', userId),
			amount: redis.hgetAsync('tab', userId),
			id: userId
		});
	}

	async getOutstandingTabs() {
		const tabs = await this.getTabs();
		return _.filter(tabs, (tab) => tab.amount > 0);
	}

	async getTabs() {
		const [tabs, users] = await Promise.all([
			redis.hgetallAsync('tab'),
			redis.hgetallAsync('users')
		]);

		return _.chain(tabs)
			.reduce((acc, amount, id) => {
				acc.push({ amount, id, name: users[id] })
				return acc;
			}, [])
			.orderBy('amount', 'desc')
			.value();
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