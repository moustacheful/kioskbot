import Slack from 'src/lib/slack';
import numeral from 'numeral';

export default {
	payment({ result, paidBy }) {
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
				`@${result.user.username}`
			)
			.catch(() => console.log('Could not send message'));

		// Notify admins, for logging purposes.
		Slack.chat
			.postMessage(
				{
					text: `Deuda pagada para *${result.user.username}* (_pagado por ${paidBy}_)`,
					attachments,
				},
				process.env.SLACK_CHANNEL_ADMIN
			)
			.catch(() => console.log('Could not send message'));

		return attachments;
	},
};
