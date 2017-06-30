import mongoose from 'mongoose';
import numeral from 'numeral';

const schema = new mongoose.Schema({
	product: {
		type: String,
		required: true,
	},
	amount: {
		type: Number,
		required: true,
		min: 1,
	},
	quantity: {
		type: Number,
		required: true,
		default: 1,
		min: 1,
	},
	reverted: {
		type: Boolean,
		default: false,
	},
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	createdAt: { type: Date, default: Date.now },
});

schema.virtual('formattedAmount').get(function() {
	return numeral(this.amount).format();
});

export default mongoose.model('Purchase', schema);
