import mongoose from 'mongoose';

const schema = new mongoose.Schema({
	product: {
		type: String,
		required: true,
	},
	amount: {
		type: Number,
		required: true,
	},
	quantity: {
		type: Number,
		required: true,
		default: 1,
		min: 1,
	},
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	createdAt: { type: Date, default: Date.now },
});

schema.methods.revert = async function () {
	await this.remove();
};

export default mongoose.model('Purchase', schema);
