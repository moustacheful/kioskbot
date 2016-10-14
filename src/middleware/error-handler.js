import { pick } from 'lodash';

export default async function(ctx, next) {
	try {
		await next();
	} catch (error) {
		const fields = ['message'];
		if (process.env.DEBUG) fields.push('stack');
		if (error.status) ctx.status = error.status;
		if (error.stack) error.stack = error.stack.split('\n');
		
		ctx.body = pick(error, fields);
	}
}