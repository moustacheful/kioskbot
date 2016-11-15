import mongoose from 'mongoose';

const credentialSchema = new mongoose.Schema({
	service: {
		type: String,
		required: true,
		unique: true,
	},
	payload: {
		type: mongoose.Schema.Types.Mixed,
		required: true
	},
	createdAt: { type: Date, default: Date.now },
});

credentialSchema.statics.for = function(service) {
	return this.findOne({ service }).then(s => {
		if(!s) throw new Error(`No credentials for ${service}`);
		return s.payload;
	});
};

export default mongoose.model('Credential', credentialSchema);
