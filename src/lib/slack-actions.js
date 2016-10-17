import _ from 'lodash';
import numeral from 'numeral';
import numeralES from 'numeral/languages/es';
import redis from 'src/lib/redis';
import kiosk from 'src/lib/kiosk-service';
import googleSheet from 'src/lib/google-sheet';

numeral.language('es', numeralES);
numeral.language('es');
numeral.defaultFormat('$0,0');

const adminActions = {
	/**
	 * Returns an ordered list with all outstanding tabs
	 */
	'deudas': async (ctx) => {
		const tabs = await kiosk.getOutstandingTabs();
		const list = _.map(tabs, (tab) => {
			return `- *${tab.name}* - ${numeral(tab.amount).format()}`;
		}).join('\n');

		ctx.body = {
			text: 'Usuarios con deudas:',
			attachments: [{ text: list, mrkdwn_in: ['text'] }],
		};
	},

	/**
	 * Pay a users's tab
	 */
	'pagar': async (ctx) => {
		const [, user, amount] = ctx.state.slack.text.split(' ');
		const result = await kiosk.payTabForUser(user.replace('@', ''), amount)

		ctx.body = {
			text: `Deuda para *${user}* pagada.`,
			attachments: [{
				fields: [
					{ short: true, title: 'Pagado', value: numeral(amount).format() },
					{ short: true, title: 'Restante', value: numeral(result.remainder).format() },
				]
			}]
		}
	},

	/**
	 * Updates the kiosk
	 */
	'update': async (ctx) => {
		const products = await googleSheet.read();
		ctx.body = `Ok! ${products.length} productos ingresados.`;
	},
};

const actions = {
	/**
	 * Returns requesting user's tab
	 */
	'deuda': async (ctx) => {
		const userId = ctx.state.slack.user.id;
		const tab = await kiosk.getTabById(userId);

		ctx.body = tab ? `Debes ${numeral(tab.amount).format()} :rat:` : 'No registras deuda';
	},


	/**
	 * Gives out a list of the available products.
	 */
	'stock': async (ctx) => {
		const chunks = _.chunk(await kiosk.getStock(), 5);
		const attachments =  _.map(chunks, (chunk) => ({
			callback_id: 'purchase',
			color: '#3AA3E3',
			attachment_type: 'default',
			actions: _.map(chunk, item => ({
				name: item.item,
				text: `${item.item} (${numeral(item.precio).format()})`,
				type: 'button',
				value: item.slug,
			})),
		}));

		ctx.body = {
			text: 'Kioskbot - en stock:',
			attachments
		};
	},

	/**
	 * Purchase and item.
	 */
	'purchase': async (ctx) => {
		const payload = ctx.state.slack;
		const productSlug = _.first(payload.actions).value;
		const { debt, product } = await kiosk.purchase(productSlug, payload.user);
		
		ctx.body = {
			text: `Compraste ${product.item}!`,
			attachments: [{
				text: `Debes ${numeral(debt).format()} de momento.`
			}]
		};
	}
};

export default async function(action, ctx, ...rest){
	let user = ctx.state.slack.user;
	let selectedAction = actions[action];

	if (!selectedAction && adminActions[action]) {
		if(!_.includes(process.env.SLACK_ADMINS.split(','), user.name)) {
			ctx.throw('No estás autorizado para ejecutar este comando.', 401);			
		}
		selectedAction = adminActions[action];
	} 

	if (!selectedAction) ctx.throw(`Comando inválido: ${action}`, 404);

	return await selectedAction(ctx, ...rest);
}