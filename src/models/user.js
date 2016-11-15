import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
	sid: {
		type: String,
		required: true,
		unique: true,
	},
	username: String,
	tab: {
		type: Number,
		required: true,
		default: 0,
		min: 0,
	},
	createdAt: { type: Date, default: Date.now },
});

// Static functions
// userSchema.statics.fn = function (args) {};

// Instance methods
userSchema.methods.getPurchases = function () {};

export default mongoose.model('User', userSchema);
