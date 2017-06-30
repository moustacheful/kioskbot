import mongoose from 'mongoose';
import numeral from 'numeral';

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
	index: {
		type: Number,
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
productSchema.virtual('formattedPrice').get(function() {
	return numeral(this.precio).format();
});

export default mongoose.model('Product', productSchema);
