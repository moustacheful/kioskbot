import mongoose from 'mongoose';
import Promise from 'bluebird';
import numeral from 'numeral';
import numeralES from 'numeral/languages/es';
import Credential from 'src/models/credential';
import Slack from 'src/lib/slack';
import 'src/lib/scheduled';

// Config numeral function stuff
numeral.language('es', numeralES);
numeral.language('es');
numeral.defaultFormat('$0,0');

// Connect to mongodb
mongoose.Promise = Promise;
mongoose.connect(process.env.MONGODB_URI);

// Config the slack module
Credential.for('slack').then(token => Slack.config({
	token,
	defaultUser: 'Kioskbot'
}));
