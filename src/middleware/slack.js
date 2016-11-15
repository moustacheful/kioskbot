import _ from 'lodash';
import User from 'src/models/user';
import { nestify } from 'src/lib/utils';

export default async function(ctx, next) {
	try {
		let incoming = ctx.request.body;

		if (incoming.payload) {
			// Don't parse payload on development
			const shouldParse = process.env.NODE_ENV !== 'development';
			incoming = shouldParse ? JSON.parse(incoming.payload) : incoming.payload;
		} else {
			// Data comes from a slash command, normalize it to be nested when needed.
			incoming = nestify(incoming);
		}

		if (
			process.env.NODE_ENV !== 'development' &&
			incoming.token !== process.env.SLACK_TOKEN
		){
			ctx.throw('Not allowed.', 401);
		}

		// Pass the state for the rest of the application
		ctx.state.slack = incoming;
		ctx.state.user = User.findOneOrCreate({ sid: incoming.user.id });

		await next();

		if (_.isString(ctx.body)) ctx.body = { text: ctx.body };

		ctx.body = {
			mrkdwn: true,
			response_type: 'ephemeral',
			footer: 'Kioskbot',
			ts: Date.now(),
			...ctx.body
		}

	} catch (error) {
		// Handle errors in slack format.
		if (error.status) ctx.status = error.status;
		const template = error.status && error.status == 200 ? '<%= message %>' : ':boom: <%= message %> :fire:';

		ctx.body = {
			mrkdwn: true,
			response_type: 'ephemeral',
			text: _.template(template)({ message: error.message || error }),
			stack: error.stack && process.env.DEBUG ? error.stack : null
		};

		console.error(error.message);
		console.error(error.stack);
	}
}
