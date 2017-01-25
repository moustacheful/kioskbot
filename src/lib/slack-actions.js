import _ from 'lodash';
import numeral from 'numeral';
import kiosk from 'src/lib/kiosk-service';
import googleSheet from 'src/lib/google-sheet';
import Slack from 'src/lib/slack';

const adminActions = {
	/**
	 * Returns an ordered list with all outstanding tabs
	 */
	'deudas': async (ctx) => {
		const users = await kiosk.getOutstandingTabs();

		const list = _.map(users, (user) => {
			return `- *${user.username}*   ${numeral(user.debt).format()}`;
		});

		if (!list.length) list.push(`No hay usuarios con deudas.`);

		ctx.body = {
			text: 'Usuarios con deudas:',
			attachments: [{ text: list.join('\n'), mrkdwn_in: ['text'] }],
		};
	},

	/**
	 * Pay a users's tab
	 */
	'pagar': async (ctx) => {
		let [, user, amount] = ctx.state.slack.text.split(' ');
		user = user.replace('@', '');

		const result = await kiosk.payTabForUser(user, amount);

		const attachments = [{
			fields: [
				{ short: true, title: 'Pagado', value: numeral(result.paid).format() },
				{ short: true, title: 'Restante', value: numeral(result.remainder).format() },
			]
		}];

		// Notify the user about payment received
		Slack.chat.postMessage({
			text: `Gracias! Acabamos de recibir tu pago.`,
			attachments
		}, `@${user}`)
			.catch(() => console.log('Could not send message'));

		// Respond the admin
		ctx.body = {
			text: `Deuda para *${user}* pagada.`,
			attachments
		};
	},

	/**
	 * Updates the kiosk
	 */
	'update': async (ctx) => {
		const products = await googleSheet.read();
		ctx.body = `Ok! ${products.length} productos ingresados.`;
	},

	'info': async (ctx) => {
		const [, username, purchasesCount = 3] = ctx.state.slack.text.split(' ');
		if (!username) ctx.throw('Debes especificar un usuario. Ej.: */kioskbot info @usuario*');

		const { user, purchases } = await kiosk.getTabForUser(username.replace('@', ''), purchasesCount);

		const attachments = _.map(purchases, (purchase) => ({
			mrkdwn_in: ['text'],
			callback_id: 'purchase',
			attachment_type: 'default',
			text: `${purchase.product} (${purchase.quantity} un.) *${numeral(purchase.amount).format()}*`,
			actions: [{
				name: 'revertir',
				text: 'Cancelar',
				type: 'button',
				style: 'danger',
			}],
			footer: 'Compra realizada ',
			ts: purchase.createdAt.getTime() / 1000
		}));

		let text = user.debt ? `${username} debe *${numeral(user.debt).format()}* :rat:` : `${username} no registra deuda :tada:`;
		text+=`\n Últimas ${purchasesCount} compras:`,
		ctx.body = { text, attachments };
	},

	cancelar: async (ctx) => {

	}
};

const actions = {
	/**
	 * Returns requesting user's tab
	 */
	'deuda': async (ctx) => {
		const user = ctx.state.user;

		ctx.body = user.debt ? `Debes ${numeral(user.debt).format()} :rat:` : 'No registras deuda :tada:';
	},


	/**
	 * Gives out a list of the available products.
	 */
	'stock': async (ctx) => {
		const chunks = _.chunk(await kiosk.getStock(), 3);
		const attachments =  _.map(chunks, (chunk) => ({
			callback_id: 'purchase',
			color: '#3AA3E3',
			attachment_type: 'default',
			actions: _.map(chunk, item => ({
				name: item.item,
				text: `${numeral(item.precio).format()} | ${item.item}`,
				type: 'button',
				value: item._id,
			})),
		}));

		attachments.push({
			callback_id: 'cancel',
			color: 'danger',
			actions: [{
				name: 'cancel',
				text: 'Cancelar',
				type: 'button',
				value: 'cancel',
				style: 'danger',
			}]
		})

		ctx.body = {
			text: 'Kioskbot - en stock:',
			attachments
		};
	},

	/**
	 * Cancels an action and deletes the previous message
	 */
	'cancel': async (ctx) => {
		ctx.body = {
			text: 'Cancelado!',
			delete_original: true,
		};
	},

	/**
	 * Purchase and item.
	 */
	'purchase': async (ctx) => {
		const payload = ctx.state.slack;
		const productId = _.first(payload.actions).value;
		const { debt, product } = await kiosk.purchase(productId, ctx.state.user);

		ctx.body = {
			text: `Compra exitosa!`,
			attachments: [{
				text: `Compraste ${product.item}.`,
				color: 'good',
				fields: [
					{ short: true, title: 'Precio', value: numeral(product.precio).format() },
					{ short: true, title: 'Deuda', value: numeral(debt).format() },
				]
			}]
		};
	}
};

export default async function(action, ctx, ...rest){
	let user = ctx.state.user;
	let selectedAction = actions[action];

	if (!selectedAction && adminActions[action]) {
		if(!user.isAdmin) ctx.throw('No estás autorizado para ejecutar este comando.', 401);
		selectedAction = adminActions[action];
	}

	if (!selectedAction) ctx.throw(`Comando inválido: ${action}`, 404);

	return await selectedAction(ctx, ...rest);
}
