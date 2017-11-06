import _ from 'lodash';
import numeral from 'numeral';
import url from 'url';
import qs from 'qs';
import moment from 'moment';
import kiosk from 'src/lib/kiosk-service';
import googleSheet from 'src/lib/google-sheet';
import Slack from 'src/lib/slack';
import Notify from 'src/lib/slack-notifications';

const adminActions = {
	/**
	 * Returns an ordered list with all users with store credit
	 */
	abonos: async ctx => {
		const users = await kiosk.getUsersWithCredit();

		const list = _.map(users, user => {
			return `- *${user.username}*   ${user.formattedDebt}`;
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
			return `- *${user.username}*   ${user.formattedDebt}`;
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
		const currentUser = ctx.state.user;
		let [, user, amount] = ctx.state.slack.text.split(' ');
		user = user.replace('@', '');

		const result = await kiosk.payTabForUser({ username: user, amount });

		const attachments = Notify.payment({
			result,
			paidBy: `@${currentUser.username}`,
		});

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

		const dateLimit = moment().subtract(1, 'day');

		const attachments = _.map(purchases, purchase => {
			const actions = !purchase.reverted &&
				moment(purchase.createdAt).isAfter(dateLimit)
				? {
						actions: [
							{
								name: 'purchase_id',
								text: 'Cancelar',
								type: 'button',
								style: 'danger',
								value: purchase._id,
							},
						],
					}
				: {};

			let attachmentLabel = `${purchase.product} (${purchase.quantity} un.) `;
			attachmentLabel += purchase.reverted
				? `~${purchase.formattedAmount}~ *REVERTIDO*`
				: `*${purchase.formattedAmount}*`;

			return {
				mrkdwn_in: ['text'],
				callback_id: 'revert',
				attachment_type: 'default',
				text: attachmentLabel,
				...actions,
				footer: 'Compra realizada ',
				ts: purchase.createdAt.getTime() / 1000,
			};
		});

		let text = '';

		if (user.debt > 0) {
			text = `${username} debe  ${user.formattedDebt} :rat:`;
		} else if (user.debt < 0) {
			text = `${username} tiene ${user.formattedDebt} a favor :money_with_wings:`;
		} else {
			text = `${username} no registra deuda :tada:`;
		}

		text += `\n Últimas ${purchasesCount} compras:`;
		ctx.body = { text, attachments };
	},

	revert: async ctx => {
		const purchaseId = _.get(ctx.state.slack, 'actions.0.value');

		const { user, product, purchase } = await kiosk.revertPurchase(purchaseId);

		const attachments = [
			{
				text: `${product.item}`,
				color: 'good',
				fields: [
					{
						short: true,
						title: 'Reembolsado',
						value: purchase.formattedAmount,
					},
					{
						short: true,
						title: user.debt < 0 ? 'Crédito' : 'Deuda',
						value: user.formattedDebt,
					},
				],
			},
		];

		const message = {
			text: `Compra revertida para *@${user.username}* (${product.item} - ${purchase.formattedAmount}) por @${ctx.state.user.username}`,
			attachments,
		};

		// Notify user
		Slack.chat.postMessage(
			{
				...message,
				text: `Compra revertida (${product.item} - ${purchase.formattedAmount}) por @${ctx.state.user.username}`,
			},
			`@${user.username}`
		);

		// Notify admin channel
		Slack.chat.postMessage(message, process.env.SLACK_CHANNEL_ADMIN);

		// Ephemeral notification
		ctx.body = message;

		// TODO: analytics
	},
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

		const userPurchases = await user.getPurchases(3);

		const purchasesAttachments = userPurchases.length
			? [
					{
						text: `Últimas ${userPurchases.length} compras:`,
					},
					..._.map(userPurchases, purchase => {
						let actions = undefined;
						const product = _.find(products, { item: purchase.product });

						if (product) {
							actions = [
								{
									name: 'item',
									text: 'Comprar de nuevo',
									type: 'button',
									value: product._id,
								},
							];
						}

						const purchasePriceLabel = purchase.reverted
							? `~${purchase.formattedAmount}~ *REVERTIDO*`
							: purchase.formattedAmount;

						return {
							mrkdwn_in: ['text'],
							text: `*${purchase.product}*: ${purchasePriceLabel} - ${moment(purchase.createdAt).fromNow()}`,
							callback_id: 'purchase',
							actions,
						};
					}),
				]
			: [];

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
							text: `${product.formattedPrice} | ${product.item}`,
							value: product._id,
						})),
					},
				],
			},
			...purchasesAttachments,
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
	 * Purchase an item.
	 */
	purchase: async ctx => {
		const payload = ctx.state.slack;
		const productId =
			_.get(payload, 'actions.0.selected_options.0.value') ||
			_.get(payload, 'actions.0.value');

		const currentDebt = ctx.state.user.debt;

		if (currentDebt >= (process.env.MAX_DEBT || Infinity))
			ctx.throw(
				`*Compra no realizada*: Kioskbot no fía más de ${numeral(process.env.MAX_DEBT).format()} y debes ${ctx.state.user.formattedDebt}.`,
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
							value: product.formattedPrice,
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

		Slack.chat.postMessage(
			`${ctx.state.user.username} acaba de comprar ${product.item}`,
			process.env.SLACK_CHANNEL_ADMIN
		);

		if (!ctx.state.visitor) return;

		ctx.state.visitor
			.transaction(purchase._id.toString(), purchase.amount)
			.item({
				in: product.item,
				ip: product.precio,
				iq: purchase.quantity,
			});
	},

	wire_user_selection: (ctx) => {
		const { actionParams } = ctx.state;

		if (actionParams.apiKey !== process.env.KB_SERVICES_API_KEY) ctx.throw('Nope.');

		const slackId = _.get(ctx.state.slack, 'actions.0.selected_options.0.value') ;
		const result = await kiosk.payTabForUser({ slackId, amount: actionParams.amount });

		Notify.payment({ result, paidBy: 'Payment Gateway' });
	}
};

export default async function(actionString, ctx, ...rest) {
	let user = ctx.state.user;
	let parsedAction = url.parse(actionString);

	const action = parsedAction.pathname;
	ctx.state.actionParams = qs.parse(parsedAction.query);

	let selectedAction = actions[action];
	if (!selectedAction && adminActions[action]) {
		if (!user.isAdmin)
			ctx.throw('No estás autorizado para ejecutar este comando.', 401);
		selectedAction = adminActions[action];
	}

	if (!selectedAction) ctx.throw(`Comando inválido: ${action}`, 404);

	return await selectedAction(ctx, ...rest);
}
