import mongoose from 'mongoose';
import Purchase from './purchase';

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
userSchema.methods.getPurchases = function (count = 3) {
	return Purchase
		.find({ user: this._id })
		.sort({ createdAt: -1 })
		.limit(parseInt(count));
};

userSchema.virtual('isAdmin').get(function () {
	return process.env.SLACK_ADMINS.split(',').includes(this.username);
});

export default mongoose.model('User', userSchema);
