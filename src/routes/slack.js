import Router from 'koa-router';
import qs from 'querystring';
import bodyParser from 'koa-bodyparser';
import _ from 'lodash';
import SlackMiddleware from 'src/middleware/slack';
import slackActions from 'src/lib/slack-actions';
import fetch from 'node-fetch';

const authRouter = Router({ prefix: '/slack/auth' });

authRouter.use(bodyParser());

authRouter.get('/', async (ctx) => {
	const scope = [
		'commands'
	];

	ctx.redirect(`https://slack.com/oauth/authorize?scope=${scope.join(',')}&client_id=${process.env.SLACK_CLIENT_ID}`);
});

authRouter.get('/callback', async (ctx) => {
	const res = await fetch('https://slack.com/api/oauth.access', {
		method: 'post',
		body: qs.stringify({
			client_id: process.env.SLACK_CLIENT_ID,
			client_secret: process.env.SLACK_CLIENT_SECRET,
			redirect_uri: process.env.SLACK_CALLBACK,
			code: ctx.query.code,
		}),
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	}).then(res => res.json());

	ctx.assert(res.ok, 'Slack login failed.', 401);
	
	await redis.setAsync('token:slack', res.access_token);
	ctx.body = await redis.getAsync('token:slack');
});

const router = Router({ prefix: '/slack' });

router.use(bodyParser());
router.use(SlackMiddleware);

router.post('/', async (ctx) => {
	await slackActions('stock', ctx);
})

router.post('/action', async (ctx) => {
	const payload = JSON.parse(ctx.request.body.payload);
	await slackActions(payload.callback_id, ctx, payload);
});

export default function(app) {
	app.use(router.routes());
	app.use(router.allowedMethods());
	app.use(authRouter.routes());
	app.use(authRouter.allowedMethods());
}