export default async function(ctx, next) {
	let incoming = ctx.request.body;
	if(incoming.payload) incoming = JSON.parse(incoming.payload);
	
	if (
		process.env.NODE_ENV !== 'development' &&
		incoming.token !== process.env.SLACK_TOKEN
	){
		ctx.throw('Not allowed.', 401);
	}
	try {
		await next();
	} catch (error) {
		if (error.status) ctx.status = error.status;

		ctx.body = {
			response_type: 'ephemeral',
			text: ':boom: ' + error.message || error,
		}
	}
}
