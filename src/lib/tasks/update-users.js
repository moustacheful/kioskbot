import Promise from 'bluebird';
import _ from 'lodash';
import Slack from 'src/lib/slack';
import User from 'src/models/user';

export default async () => {
	let users = await Slack.users.list();
	users = _.reject(users.members, 'is_bot');

	Promise.map(users, User.findOneOrUpsertFromSlack);
};
