import Promise from 'bluebird';
import google from 'googleapis';
import Router from 'koa-router';
import redis from 'src/lib/redis';

Promise.promisifyAll(google.auth.OAuth2.prototype);

const router = Router({ prefix: '/auth' });
const scope = [
	'https://www.googleapis.com/auth/spreadsheets',
	'https://www.googleapis.com/auth/drive.readonly',
];
const oAuth = new google.auth.OAuth2(
	process.env.GOOGLE_CLIENT_ID,
	process.env.GOOGLE_CLIENT_SECRET,
	process.env.GOOGLE_CALLBACK
);

router.get('/', async (ctx) => {
	ctx.redirect(oAuth.generateAuthUrl({
		approval_prompt: 'force',
		access_type: 'offline',
		scope
	}));
});

router.get('/callback', async (ctx) => {
	const [token] = await oAuth.getTokenAsync(ctx.query.code);
	await redis.setAsync('token', JSON.stringify(token));
	
	ctx.body = await redis.getAsync('token');
});

export default function (app) {
	console.log('mounting gapps routes');
	app.use(router.routes());
	app.use(router.allowedMethods());
};
