import fetch from 'node-fetch';
import Promise from 'bluebird';
import qs from 'querystring';

class Slack {
	static config(opts) {
		Slack._token = opts.token;
		Slack._defaultUser = opts.defaultUser;
	}

	static getToken(data) {
		return Slack._makeRequest('oauth.access', data)
	}

	static _makeRequest(path, data = {}, method = 'POST') {
		return fetch(`${Slack._base}${path}`, {
			method,
			body: qs.stringify({
				token: Slack._token,
				...data
			}),
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
		})
		.then(res => res.json())
		.then(res => {
			if (res.ok) return res;
			throw new Error(res.error);
		});
	}
}

Slack._base = 'https://slack.com/api/';
Slack.chat = {
	postMessage: (body, channel) => {
		return Slack._makeRequest('chat.postMessage', {
			username: Slack._defaultUser,
			text: body,
			channel: channel,
		});
	}
}

Slack.users = {
	list: () => Slack._makeRequest('users.list')
}

export default Slack;
