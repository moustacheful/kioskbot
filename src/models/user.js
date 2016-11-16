import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
	sid: {
		type: String,
		required: true,
		unique: true,
	},
	username: String,
	debt: {
		type: Number,
		required: true,
		default: 0,
		min: 0,
	},
	createdAt: { type: Date, default: Date.now },
});

// Static functions
userSchema.statics.findOneOrCreateFromSlack = async function (data) {
	let user = await this.findOne({ sid: data.id });
	if (!user) user = await this.create({ sid: data.id, username: data.name });
	return user;
};

// Instance methods
userSchema.methods.getPurchases = function () {};

export default mongoose.model('User', userSchema);
