export default async function(ctx, next) {
	let incoming = ctx.request.body;
	if(incoming.payload) incoming = JSON.parse(incoming.payload);
	
	if (
		process.env.NODE_ENV !== 'development' &&
		incoming.token !== process.env.SLACK_TOKEN
	){
		ctx.throw('Not allowed.', 401);
	}
	await next();
}
