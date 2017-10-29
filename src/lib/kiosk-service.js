import _ from 'lodash';
import moment from 'moment';
import Promise from 'bluebird';
import googleSheet from 'src/lib/google-sheet';
import Product from 'src/models/product';
import Purchase from 'src/models/purchase';
import User from 'src/models/user';
import Slack from 'src/lib/slack';
import { Types } from 'mongoose';
import { ProductIndex } from 'src/lib/algolia';

class KioskService {
	constructor() {
		googleSheet.on('stockUpdated', this.updateStock.bind(this));
	}

	async getStock(ids = []) {
		const q = { stockActual: { $gt: 0 } };
		if (ids.length) q._id = { $in: ids.map(Types.ObjectId) };

		return Product.find(q);
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

		const [, , purchase] = await Promise.all([
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

		return {
			purchase,
			debt: updatedUser.debt,
			product: updatedProduct,
		};
	}

	async revertPurchase(purchaseId) {
		const purchase = await Purchase.findById(purchaseId).populate('user');
		if (!purchase) throw new Error(`No se encontró la compra ${purchaseId}.`);
		if (purchase.reverted)
			throw new Error('Esta compra ya había sido revertida.');

		const dateLimit = moment().subtract(1, 'day');
		if (moment(purchase.createdAt).isBefore(dateLimit)) {
			throw new Error('Esta compra es muy antigua :(, debe ser máximo 1 día.');
		}

		const product = await Product.findOne({ item: purchase.product });
		if (!product) throw new Error('No se encontró el producto.');

		await Promise.all([
			product.update({
				$inc: {
					stockActual: 1,
				},
			}),
			purchase.user.update({
				$inc: {
					debt: -purchase.amount,
				},
			}),
			purchase.update({
				reverted: true,
			}),
		]);

		const [updatedUser, updatedProduct] = await Promise.all([
			User.findById(purchase.user._id),
			Product.findById(product._id),
		]);

		const { index, stockActual } = updatedProduct;

		googleSheet.update(index, 2, stockActual);

		return {
			user: updatedUser,
			product: updatedProduct,
			purchase: purchase,
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

	getUsersWithCredit() {
		return User.find({ debt: { $lt: 0 } }).sort({ debt: 1 });
	}

	searchProduct(query) {
		return ProductIndex.search({
			query,
			getRankingInfo: true,
			attributesToHighlight: [],
		});
	}
}

export default new KioskService();
