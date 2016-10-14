import _ from 'lodash';
import redis from 'src/lib/redis';
import kiosk from 'src/lib/kiosk-service';
import googleSheet from 'src/lib/google-sheet';

const actions = {
	'deuda': async (ctx) => {
		const userId = ctx.request.body.user_id;
		const debt = await redis.hgetAsync('tab', userId)

		ctx.body = debt;
	},

	'update': async (ctx) => {
		await googleSheet.read();
		ctx.body = "ok!";
	},

	'stock': async (ctx) => {
		ctx.body = {
			text: 'Kioskbot',
			attachments: [{
				text: 'Inventario:',
				fallback: '??',
				callback_id: 'purchase',
				color: '#3AA3E3',
				attachment_type: 'default',
				actions: _.map(await kiosk.getStock(), item => {
					return {
						name: item.item,
						text: `${item.item} ($${item.precio})`,
						type: 'button',
						value: item.slug,
					}
				}),
			}],
		}
	},

	'purchase': async (ctx, payload) => {
		const productSlug = _.first(payload.actions).value;
		const { debt, product } = await kiosk.purchase(productSlug, payload.user.id);
		ctx.body = {
			response_type: 'ephemeral',
			text: `Compraste ${product.item}!`,
			attachments: [{
				text: `Debes $${debt} de momento.`
			}]
		}
	}
};

export default async function(action, ctx, ...rest){
	if (!actions[action]) {
		ctx.throw(`Invalid action: ${action}`, 404);
	}

	return await actions[action](ctx, ...rest);
}