import _ from 'lodash';
import fetch from 'node-fetch';
import Promise from 'bluebird';
import qs from 'querystring';

class Slack {
	static config(opts) {
		Slack._token = opts.token;
		Slack._defaultUser = opts.defaultUser;
	}

	static getToken(data) {
		return Slack._makeRequest('oauth.access', data);
	}

	static _makeRequest(path, data = {}, method = 'POST') {
		return fetch(`${Slack._base}${path}`, {
			method,
			body: qs.stringify({
				token: Slack._token,
				...data,
			}),
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		})
			.then(res => res.json())
			.then(res => {
				if (res.ok) return res;
				throw new Error(res.error);
			});
	}

	static buildMessage(payload) {
		if (_.isString(payload)) payload = { text: payload };
		return {
			mrkdwn: true,
			...payload,
		};
	}
}

Slack._base = 'https://slack.com/api/';
Slack.chat = {
	postMessage: (body, channel) => {
		if (process.env.NODE_ENV === 'development') {
			console.log('Would be sending:', body, 'to', channel);
			return Promise.resolve();
		}

		let { attachments, ...messageBody } = Slack.buildMessage(body);
		// Stringify attachments
		if (attachments) attachments = JSON.stringify(attachments);

		return Slack._makeRequest('chat.postMessage', {
			username: Slack._defaultUser,
			channel: channel,
			...messageBody,
			attachments,
		});
	},
};

Slack.users = {
	list: () => Slack._makeRequest('users.list'),
};

Slack.channels = {
	list: opts => Slack._makeRequest('channels.list', opts),
};

Slack.groups = {
	list: opts => Slack._makeRequest('groups.list', opts),
};

export default Slack;
