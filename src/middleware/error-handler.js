import { pick } from 'lodash';

export default async function(ctx, next) {
	try {
		await next();
	} catch (error) {
		const fields = ['message'];
		if (process.env.DEBUG) fields.push('stack');
		
		ctx.body = pick(error, fields);
	}
}