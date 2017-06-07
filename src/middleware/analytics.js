import ua from 'universal-analytics';

const uaId = process.env.GOOGLE_UA_ID;

export default async (ctx, next) => {
	if (!uaId) return next();
	if (!ctx.state.user) {
		console.warn(
			'No user present in context state, not using analytics. Remember using this after the user middleware.'
		);
		return next();
	}

	ctx.state.visitor = ua(uaId, ctx.state.user._id, {
		strictCidFormat: false,
		https: true,
	});

	await next();

	ctx.state.visitor.send();
};
