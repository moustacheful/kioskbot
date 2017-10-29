export default async (ctx, next) => {
	if (
		ctx.headers['x-kb-services-api-token'] !== process.env.KB_SERVICES_API_KEY
	)
		ctx.throw('Not allowed', 401);

	await next();
};
