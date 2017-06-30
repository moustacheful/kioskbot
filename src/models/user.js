import mongoose from 'mongoose';
import numeral from 'numeral';
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
	},
	createdAt: { type: Date, default: Date.now },
});

// Static functions
userSchema.statics.findOneOrUpsertFromSlack = function(data) {
	return User.findOneAndUpdate(
		{ sid: data.id },
		{
			sid: data.id,
			username: data.name,
		},
		{ upsert: true, new: true, setDefaultsOnInsert: true }
	);
};

// Instance methods
userSchema.methods.getPurchases = function(count = 3) {
	return Purchase.find({ user: this._id })
		.sort({ createdAt: -1 })
		.limit(parseInt(count));
};

userSchema.virtual('formattedDebt').get(function() {
	return numeral(Math.abs(this.debt)).format();
});

userSchema.virtual('isAdmin').get(function() {
	return process.env.SLACK_ADMINS.split(',').includes(this.username);
});

const User = mongoose.model('User', userSchema);
export default User;
