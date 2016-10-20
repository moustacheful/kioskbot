import Router from 'koa-router';
import fetch from 'node-fetch';

const router = Router();

router.get('/heartbeat', async (ctx) => {
	ctx.body = 'ok';
})

setInterval(() => fetch(process.env.BASE_URL + '/heartbeat') ,20000);

export default function(app) {
	app.use(router.routes());
	app.use(router.allowedMethods());
}