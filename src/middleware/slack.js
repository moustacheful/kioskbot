export default async function(ctx, next) {
	const incoming = ctx.request.body;
	console.log(process.env.NODE_ENV)
	if (
		process.env.NODE_ENV !== 'development' &&
		incoming.token !== process.env.SLACK_TOKEN
	){
		ctx.throw('Not allowed.', 401);
	}
	await next();
}
