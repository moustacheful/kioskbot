import Slack from 'src/lib/slack';
import User from 'src/models/user';

export default function () {
	User.find({ debt: { $gt: 0 } })
		.exec()
		.map(user => {
			const message = `Oe paga las moneas, debes **${user.formattedDebt}**.`;
			Slack.chat.postMessage(message, `@${user.username}`);
		})
};
