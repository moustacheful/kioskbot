import _ from 'lodash';
import Promise from 'bluebird';
import googleSheet from 'src/lib/google-sheet';
import Product from 'src/models/product';
import Purchase from 'src/models/purchase';
import User from 'src/models/user';
import Slack from 'src/lib/slack';

class KioskService {
	constructor() {
		googleSheet.on('stockUpdated', this.updateStock.bind(this));
	}

	async getStock() {
		return Product.find({ stockActual: { $gt: 0 } });
	}

	async updateStock(newStock, revisionData) {
		// Remove all products
		await Product.remove({});
		// And insert them again
		await Promise.map(newStock, row => Product.create(row));
		console.log('Products updated!');
	}

	async purchase(productId, user, quantity = 1) {
		if (!user) throw new Error('No user specified.');

		const product = await Product.findById(productId);

		if (!product) throw new Error('Product not available.');
		if (product.stockActual < 1) throw new Error('Product out of stock.');

		await Promise.all([
			product.update({
				$inc: {
					stockActual: -1,
				},
			}),
			user.update({
				$inc: {
					debt: product.precio,
				},
			}),
			Purchase.create({
				product: product.item,
				amount: product.precio * quantity,
				quantity: quantity,
				user: user,
			}),
		]);

		const [updatedUser, updatedProduct] = await Promise.all([
			User.findById(user._id),
			Product.findById(product._id),
		]);

		const { index, stockActual } = updatedProduct;
		// Exec async tasks.
		googleSheet.update(index, 2, stockActual);
		Slack.chat.postMessage(
			`${user.username} acaba de comprar ${product.item}`,
			'#kioskbot'
		);

		return {
			debt: updatedUser.debt,
			product: updatedProduct,
		};
	}

	async getTabForUser(username, count) {
		const user = await User.findOne({ username });
		if (!user) throw new Error(`Usuario @${username} no existe.`);
		const purchases = await user.getPurchases(count);

		return { user, purchases };
	}

	async payTabForUser(username, amount) {
		const user = await User.findOne({ username });

		if (!user)
			throw new Error(`Usuario ${username} no existe en los registros.`);
		if (!amount) amount = user.debt;

		await user.update({
			$inc: {
				debt: -amount,
			},
		});

		const updatedUser = await User.findById(user._id);
		return { paid: amount, remainder: updatedUser.debt };
	}

	getOutstandingTabs() {
		return User.find({ debt: { $gt: 0 } }).sort({ debt: -1 });
	}

	async isUpToDate(incoming) {
		// Currently unused;
		return true;
		/*
		const lastRevision = await redis.hgetallAsync('app:last-revision');
		if (lastRevision && incoming.id === lastRevision.id){
			return true;
		}
		incoming.lastModifyingUser = incoming.lastModifyingUser.displayName;
		await redis.hmset('app:last-revision', incoming);

		return false;
		*/
	}
}

export default new KioskService();
