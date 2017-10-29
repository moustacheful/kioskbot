import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import _ from 'lodash';
import SlackMiddleware from 'src/middleware/slack';
import SlackActions from 'src/lib/slack-actions';
import AnalyticsMiddleware from 'src/middleware/analytics';
import kiosk from 'src/lib/kiosk-service';

const router = Router({ prefix: '/slack' });

router.use(bodyParser());
router.use(SlackMiddleware);
router.use(AnalyticsMiddleware);

router.post('/', async ctx => {
	let [action] = ctx.state.slack.text.split(' ');
	await SlackActions(action || 'stock', ctx);
});

router.post('/action', async ctx => {
	const action = ctx.state.slack.callback_id;
	await SlackActions(action, ctx);
});

router.post('/suggestions', async ctx => {
	const payload = ctx.state.slack;

	const results = await kiosk.searchProduct(payload.value);
	// Hopefully this wont be necessary.
	const stock = await kiosk.getStock(_.map(results.hits, '_id'));

	console.log(stock);

	ctx.body = {
		options: stock.map(p => ({
			text: p.item,
			value: p._id,
		})),
	};
});

export default function(app) {
	app.use(router.routes());
	app.use(router.allowedMethods());
}
