import Slack from 'src/lib/slack';
import User from 'src/models/user';

export default function () {
	User.find({ debt: { $gt: 0 } })
		.exec()
		.map(user => {
			const message = `Recordatorio amigable de que debes **${user.formattedDebt}** :rat:.`;
			Slack.chat.postMessage(message, `@${user.username}`);
		})
};
