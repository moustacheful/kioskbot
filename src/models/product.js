import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
	item: {
		type: String,
		required: true,
		unique: true,
	},
	precio: {
		type: Number,
		required: true,
	},
	slug: {
		type: String,
		required: true,
	},
	index: { type: Number,
		required: true,
		unique: true,
	},
	stockActual: {
		type: Number,
		required: true,
		default: 0,
		min: 0,
	},
	createdAt: { type: Date, default: Date.now },
});

// Static functions
// productSchema.statics.fn = function (args) {};

export default mongoose.model('Product', productSchema);
