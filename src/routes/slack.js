import Router from 'koa-router';
import SlackMiddleware from 'src/middleware/slack';
import redis from 'src/lib/redis';
import kiosk from 'src/lib/kiosk-service';

const router = Router({ prefix: '/slack' });

router.use(bodyParser());
router.use(SlackMiddleware);

router.post('/', async (ctx) => {
	const that = await Promise.resolve('Ok')
	ctx.body = that;
});

router.get('/', async (ctx) => {
	ctx.body = await kiosk.getStock();
})

router.get('/purchase/:productSlug', async (ctx) => {
	ctx.body = await kiosk.purchase(ctx.params.productSlug, 'dacuna');
})

export function(app) {
	app.use(router.routes());
	app.use(router.allowedMethods());
}