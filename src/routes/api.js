import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import _ from 'lodash';
import apiSecurityMiddleware from 'src/middleware/api-security';
import jsonResponseMiddleware from 'src/middleware/json-response';
import kiosk from 'src/lib/kiosk-service';
import Notify from 'src/lib/slack-notifications';

const router = Router({ prefix: '/api' });

router.use(jsonResponseMiddleware);
router.use(apiSecurityMiddleware);
router.use(bodyParser());

router.get('/payment', async ctx => {
	const { user, amount } = ctx.request.body;
	const result = await kiosk.payTabForUser({ slackId: user, amount });

	Notify.payment({
		result,
		paidBy: 'API',
	});

	ctx.body = result;
});

export default function(app) {
	app.use(router.routes());
	app.use(router.allowedMethods());
}
