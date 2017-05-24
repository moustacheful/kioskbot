import _ from 'lodash';
import User from 'src/models/user';
import { nestify } from 'src/lib/utils';

export const parse = async (ctx, next) => {
	let incoming = ctx.request.body;

	if (incoming.payload) {
		// Don't parse payload on development
		const shouldParse = process.env.NODE_ENV !== 'development';
		incoming = shouldParse ? JSON.parse(incoming.payload) : incoming.payload;
	} else {
		// Data comes from a slash command, normalize it to be nested when needed.
		incoming = nestify(incoming);
	}

	// Pass the state for the rest of the application
	ctx.state.slack = incoming;
	await next();
};

export const secure = async (ctx, next) => {
	if (ctx.state.slack.token !== process.env.SLACK_TOKEN) {
		ctx.throw('Not allowed.', 401);
	}
	await next();
};

export const user = async (ctx, next) => {
	ctx.state.user = await User.findOneOrUpsertFromSlack(ctx.state.slack.user);
	await next();
};

export const errorHandler = async (ctx, next) => {
	try {
		await next();
	} catch (error) {
		// Handle errors in slack format.
		const template = ':boom: <%= message %>';

		ctx.status = 200;
		ctx.body = {
			text: _.template(template)({ message: error.message || error }),
			stack: error.stack && process.env.DEBUG ? error.stack : null,
		};

		console.error(error.message);
		console.error(error.stack);
	}
};

export const formatResponse = async (ctx, next) => {
	await next();
	if (_.isString(ctx.body)) ctx.body = { text: ctx.body };

	ctx.body = {
		mrkdwn: true,
		response_type: 'ephemeral',
		...ctx.body,
	};
};

// Export as default the sequence of middleware
export default [formatResponse, errorHandler, parse, secure, user];
