import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import _ from 'lodash';
import SlackMiddleware from 'src/middleware/slack';
import SlackActions from 'src/lib/slack-actions';
import AnalyticsMiddleware from 'src/middleware/analytics';

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

export default function(app) {
	app.use(router.routes());
	app.use(router.allowedMethods());
}
