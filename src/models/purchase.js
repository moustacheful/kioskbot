import mongoose from 'mongoose';

const purchaseSchema = new mongoose.Schema({
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

export default mongoose.model('Purchase', purchaseSchema);
