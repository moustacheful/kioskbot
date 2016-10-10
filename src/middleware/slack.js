export default async function(ctx, next) {
	const incoming = ctx.request.body;
	if (incoming.token !== process.env.SLACK_TOKEN){
		ctx.throw('Not allowed.', 401);
	}
	await next();
}
