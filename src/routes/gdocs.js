import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

const router = Router();

router.use(bodyParser());
router.post('/incoming', async (ctx) => {
	const test = {
		headers:ctx.request.headers,
		query:ctx.query,
		body:ctx.request.body
	};
	console.log(test);
	ctx.body = "ok!";
});

export default function(app) {
	app.use(router.routes());
	app.use(router.allowedMethods());
};