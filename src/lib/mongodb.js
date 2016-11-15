import mongoose from 'mongoose';
import Promise from 'bluebird';

// Connect to mongodb
mongoose.Promise = Promise;
export default mongoose.connect(process.env.MONGODB_URI);
