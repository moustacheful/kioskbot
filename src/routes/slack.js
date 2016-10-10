import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import _ from 'lodash';
import SlackMiddleware from 'src/middleware/slack';
import redis from 'src/lib/redis';
import kiosk from 'src/lib/kiosk-service';
import request from 'request-promise';

const authRouter = Router({ prefix: '/slack/auth' });

authRouter.use(bodyParser());

authRouter.get('/', async (ctx) => {
	const scope = [
		'commands'
	];

	ctx.redirect(`https://slack.com/oauth/authorize?scope=${scope.join(',')}&client_id=${process.env.SLACK_CLIENT_ID}`);
})

authRouter.get('slack-callback', '/callback', async (ctx) => {
	const token = await request('https://slack.com/api/oauth.access', {
		method: 'POST',
		json: true,
		body: {
			client_id: process.env.SLACK_CLIENT_ID,
			client_secret: process.env.SLACK_CLIENT_SECRET,
			redirect_uri: authRouter.url('slack-callback'),
			code: ctx.query.code,
		}
	});
	ctx.body = token;
});

const router = Router({ prefix: '/slack' });

router.use(bodyParser());
router.use(SlackMiddleware);

router.post('/', async (ctx) => {
	ctx.body = {
		text: 'Kioskbot',
		attachments: [{
			text: 'Inventario:',
			fallback: '??',
			callback_id: 'inventory',
			color: '#3AA3E3',
			attachment_type: 'default',
			actions: _.map(await kiosk.getStock(), item => {
				return {
					name: item.item,
					text: `${item.item} ($${item.precio})`,
					type: 'button',
					value: item.item,
				}
			}),
		}],
	};
})

router.get('/purchase/:productSlug', async (ctx) => {
	ctx.body = await kiosk.purchase(ctx.params.productSlug, 'dacuna');
})

export default function(app) {
	app.use(router.routes());
	app.use(router.allowedMethods());
	app.use(authRouter.routes());
	app.use(authRouter.allowedMethods());
}