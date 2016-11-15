import _ from 'lodash';
import Promise from 'bluebird';
import redis from './redis';
import googleSheet from 'src/lib/google-sheet';
import uuid from 'uuid';
import Credential from 'src/models/credential';
import Product from 'src/models/product';
import Purchase from 'src/models/purchase';

class KioskService {
	constructor(){
		googleSheet.on('stockUpdated', this.updateStock.bind(this));
	}

	async getStock(){
		return Product.find({ stock: { $gt: 0 } });
	}

	async updateStock(newStock, revisionData) {
		const isUpToDate = await this.isUpToDate(revisionData)
		//if (isUpToDate) return console.log('Is up to date!');

		await Product.remove({});
		await Promise.map(newStock, row => Product.create(row));
	}

	async purchase(slug, user, quantity = 1){
		if (!user) throw new Error('No user specified.');

		const product = await Product.findOne({ slug });

		if (!product) throw new Error('Product not available.');
		if (product.stockActual < 1) throw new Error('Product out of stock.');

		product.update({
			$inc: {
				stockActual: -1
			}
		});

		user.update({
			$inc: {
				tab: product.precio
			}
		});

		Purchase.create({
			product: product.item,
			amount: product.precio * quantity,
			quantity: quantity,
			user: user,
		})
		const operations = [
			['hincrby', productKey, 'stockActual', -1],
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
		googleSheet.update(product.index, 2, stockLeft);

		return {
			debt,
			product: await redis.hgetallAsync(productKey)
		};
	}

	async payTabForUser (name, amount) {
		const user = User.find({ name });

		if (!user) throw new Error(`Usuario ${name} no existe en los registros.`);
		if (user.tab - amount < 0) throw new Error(`Monto sobrepasa la deuda. _(hint: dejar vacío para pagar todo)_`);
		if (!amount) amount = user.tab;

		await user.update({
			$incr: {
				tab: -amount
			}
		});

		const remainder = user.tab;

		return { paid: amount, remainder };
	}

	async getTabById (userId) {
		return User.findOne({ sid: userId });
	}

	getOutstandingTabs() {
		return User
			.find({ tab: { $gt: 0 } })
			.sort({ tab: 1 });
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
