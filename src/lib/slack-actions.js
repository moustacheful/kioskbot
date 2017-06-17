import _ from 'lodash';
import numeral from 'numeral';
import kiosk from 'src/lib/kiosk-service';
import googleSheet from 'src/lib/google-sheet';
import Slack from 'src/lib/slack';

const adminActions = {
	/**
	 * Returns an ordered list with all users with store credit
	 */
	abonos: async ctx => {
		const users = await kiosk.getUsersWithCredit();

		const list = _.map(users, user => {
			return `- *${user.username}*   ${numeral(Math.abs(user.debt)).format()}`;
		});

		if (!list.length) list.push(`No hay usuarios con abonos.`);

		ctx.body = {
			text: 'Usuarios con abonos:',
			attachments: [{ text: list.join('\n'), mrkdwn_in: ['text'] }],
		};
	},

	/**
	 * Returns an ordered list with all outstanding tabs
	 */
	deudas: async ctx => {
		const users = await kiosk.getOutstandingTabs();

		const list = _.map(users, user => {
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
	pagar: async ctx => {
		let [, user, amount] = ctx.state.slack.text.split(' ');
		user = user.replace('@', '');

		const result = await kiosk.payTabForUser(user, amount);

		const attachments = [
			{
				fields: [
					{
						short: true,
						title: 'Pagado',
						value: numeral(result.paid).format(),
					},
					{
						short: true,
						title: result.remainder < 0 ? 'Crédito' : 'Restante',
						value: numeral(Math.abs(result.remainder)).format(),
					},
				],
			},
		];

		// Notify the user about payment received
		Slack.chat
			.postMessage(
				{
					text: `Gracias! Acabamos de recibir tu pago.`,
					attachments,
				},
				`@${user}`
			)
			.catch(() => console.log('Could not send message'));

		// Respond the admin
		ctx.body = {
			text: `Deuda para *${user}* pagada.`,
			attachments,
		};
	},

	/**
	 * Updates the kiosk
	 */
	update: async ctx => {
		const products = await googleSheet.read();
		ctx.body = `Ok! ${products.length} productos ingresados.`;
	},

	info: async ctx => {
		const [, username, purchasesCount = 3] = ctx.state.slack.text.split(' ');
		if (!username)
			ctx.throw('Debes especificar un usuario. Ej.: */kioskbot info @usuario*');

		const { user, purchases } = await kiosk.getTabForUser(
			username.replace('@', ''),
			purchasesCount
		);

		const attachments = _.map(purchases, purchase => ({
			mrkdwn_in: ['text'],
			callback_id: 'purchase',
			attachment_type: 'default',
			text: `${purchase.product} (${purchase.quantity} un.) *${numeral(purchase.amount).format()}*`,
			actions: [
				{
					name: 'revertir',
					text: 'Cancelar',
					type: 'button',
					style: 'danger',
				},
			],
			footer: 'Compra realizada ',
			ts: purchase.createdAt.getTime() / 1000,
		}));

		let text = '';

		if (user.debt > 0) {
			text = `${username} debe  ${numeral(user.debt).format()} :rat:`;
		} else if (user.debt < 0) {
			text = `${username} tiene ${numeral(Math.abs(user.debt)).format()} a favor :money_with_wings:`;
		} else {
			text = `${username} no registra deuda :tada:`;
		}

		text += `\n Últimas ${purchasesCount} compras:`;
		ctx.body = { text, attachments };
	},

	cancelar: async ctx => {},
};

const actions = {
	ayuda: async ctx => {
		const { user } = ctx.state;
		const accountInfo = !process.env.ACCOUNT_INFO
			? []
			: [
					'\n\nLa cuenta para abonar o pagar tu deuda es:',
					'>>>',
					...process.env.ACCOUNT_INFO.split('|'),
				];

		ctx.body = {
			text: [
				`Hola *@${user.username}!*\n\n`,
				'Los comandos disponibles son:',
				'*/kioskbot* _muestra el stock disponible en kioskbot_',
				'*/kioskbot deuda* _muestra tu deuda o crédito en kioskbot_',
				'*/kioskbot ayuda* _me estás leyendo ahora mismo_',
				...accountInfo,
			].join('\n'),
		};
	},
	/**
	 * Returns requesting user's tab
	 */
	deuda: async ctx => {
		const user = ctx.state.user;

		let body = '';

		if (user.debt > 0) {
			body = `Debes ${user.formattedDebt} :rat:`;
		} else if (user.debt < 0) {
			body = `Tienes ${user.formattedDebt} a favor :money_with_wings:`;
		} else {
			body = 'No registras deuda :tada:';
		}

		ctx.body = body;
	},

	/**
	 * Gives out a list of the available products.
	 */
	stock: async ctx => {
		const { user } = ctx.state;
		const products = await kiosk.getStock();

		let userDebtText = '';
		if (user.debt > 0) {
			userDebtText = `Debes *${user.formattedDebt}* :rat:.`;
		} else if (user.debt < 0) {
			userDebtText = `Tienes *${user.formattedDebt}* a favor :money_with_wings:`;
		}
		const attachments = [
			{
				callback_id: 'purchase',
				attachment_type: 'default',
				text: 'En stock:',
				actions: [
					{
						name: 'product_select',
						text: 'Seleccionar producto',
						type: 'select',
						options: _.map(products, product => ({
							text: `${numeral(product.precio).format()} | ${product.item}`,
							value: product._id,
						})),
					},
				],
			},
			{
				callback_id: 'cancel',
				color: 'danger',
				actions: [
					{
						name: 'cancel',
						text: 'Cancelar',
						type: 'button',
						value: 'cancel',
						style: 'danger',
					},
				],
			},
			{
				text: `_Si necesitas ayuda sobre cómo pagar, escribe */kioskbot ayuda*. Cualquier otra pregunta o sugerencia que tengas puedes hacerla en el canal <#${process.env.SLACK_CHANNEL_PUBLIC}>_`,
				mrkdwn_in: ['text'],
			},
		];

		ctx.body = {
			text: `Hola *@${user.username}*! ${userDebtText}\n`,
			attachments,
		};
	},

	/**
	 * Cancels an action and deletes the previous message
	 */
	cancel: async ctx => {
		ctx.body = {
			text: 'Cancelado!',
			delete_original: true,
		};
	},

	/**
	 * Purchase and item.
	 */
	purchase: async ctx => {
		const payload = ctx.state.slack;
		const productId = _.get(payload, 'actions.0.selected_options.0.value');
		const currentDebt = ctx.state.user.debt;

		if (currentDebt >= (process.env.MAX_DEBT || Infinity))
			ctx.throw(
				`*Compra no realizada*: Kioskbot no fía más de ${numeral(process.env.MAX_DEBT).format()} y debes ${numeral(currentDebt).format()}.`,
				402
			);

		const { debt, product, purchase } = await kiosk.purchase(
			productId,
			ctx.state.user
		);

		ctx.body = {
			text: `Compra exitosa!`,
			attachments: [
				{
					text: `Compraste ${product.item}.`,
					color: 'good',
					fields: [
						{
							short: true,
							title: 'Precio',
							value: numeral(product.precio).format(),
						},
						{
							short: true,
							title: debt < 0 ? 'Crédito' : 'Deuda',
							value: numeral(Math.abs(debt)).format(),
						},
					],
				},
			],
		};

		if (!ctx.state.visitor) return;

		ctx.state.visitor
			.transaction(purchase._id.toString(), purchase.amount)
			.item({
				in: product.item,
				ip: product.precio,
				iq: purchase.quantity,
			});
	},
};

export default async function(action, ctx, ...rest) {
	let user = ctx.state.user;
	let selectedAction = actions[action];

	if (!selectedAction && adminActions[action]) {
		if (!user.isAdmin)
			ctx.throw('No estás autorizado para ejecutar este comando.', 401);
		selectedAction = adminActions[action];
	}

	if (!selectedAction) ctx.throw(`Comando inválido: ${action}`, 404);

	return await selectedAction(ctx, ...rest);
}
