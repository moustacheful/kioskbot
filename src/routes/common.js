import Router from 'koa-router';

const router = Router();

router.get('/heartbeat', async (ctx) => {
	ctx.body = 'ok';
})

export default function(app) {
	app.use(router.routes());
	app.use(router.allowedMethods());
}
