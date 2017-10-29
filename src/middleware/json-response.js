import _ from 'lodash';

export default async (ctx, next) => {
	await next();

	if (_.isString(ctx.body)) ctx.body = { result: ctx.body };
};
