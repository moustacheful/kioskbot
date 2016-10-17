import Promise from 'bluebird';
import google from 'googleapis';
import Router from 'koa-router';
import redis from 'src/lib/redis';

Promise.promisifyAll(google.auth.OAuth2.prototype);

const router = Router();
const scope = [
	'https://www.googleapis.com/auth/spreadsheets',
	'https://www.googleapis.com/auth/drive.readonly',
];
const oAuth = new google.auth.OAuth2(
	process.env.GOOGLE_CLIENT_ID,
	process.env.GOOGLE_CLIENT_SECRET,
	process.env.GOOGLE_CALLBACK
);

router.get(`/${process.env.GOOGLE_DOMAIN_VERIFICATION}`, async (ctx) => {
	ctx.body = `google-site-verification: ${process.env.GOOGLE_DOMAIN_VERIFICATION}`;
});

router.get('/auth', async (ctx) => {
	ctx.redirect(oAuth.generateAuthUrl({
		approval_prompt: 'force',
		access_type: 'offline',
		scope
	}));
});

router.get('/auth/callback', async (ctx) => {
	const [token] = await oAuth.getTokenAsync(ctx.query.code);
	await redis.setAsync('token:google', JSON.stringify(token));
	
	ctx.body = await redis.getAsync('token:google');
});

export default function (app) {
	app.use(router.routes());
	app.use(router.allowedMethods());
};
