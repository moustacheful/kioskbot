import qs from 'querystring';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import Promise from 'bluebird';
import google from 'googleapis';
import Credential from 'src/models/credential';


/**
 * Google auth routes and related stuff
 */
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

router.get('/auth/google', async (ctx) => {
	ctx.redirect(oAuth.generateAuthUrl({
		approval_prompt: 'force',
		access_type: 'offline',
		scope
	}));
});

router.get('/auth/google/callback', async (ctx) => {
	const token = await oAuth.getTokenAsync(ctx.query.code);
	await Credential.create({ service: 'google', payload: token });

	ctx.body = await Credential.for('google');
});


/**
 * Slack auth routes
 */
router.get('/auth/slack', async (ctx) => {
	const scope = [
		'commands'
	];

	ctx.redirect(`https://slack.com/oauth/authorize?scope=${scope.join(',')}&client_id=${process.env.SLACK_CLIENT_ID}`);
});

router.get('/auth/slack/callback', async (ctx) => {
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
	await Credential.create({ service: 'slack', payload: res.access_token });
	ctx.body = await Credential.for('slack');
});


export default function (app) {
	app.use(router.routes());
	app.use(router.allowedMethods());
};
