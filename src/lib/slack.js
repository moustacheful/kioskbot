import fetch from 'node-fetch';

class Slack {
	constructor(token) {
		this._token = token;
		this._base = 'https://slack.com/api/';
		this._defaultUser = 'Kioskbot';
	}

	_makeRequest(path, data = {}, method = 'POST') {
		return fetch(`${this._base}${path}`, {
			method,
			body: JSON.stringify({
				token: this._token,
				...data
			}),
			headers: { 'Content-Type': 'application/json' }
		}).then(res => res.json())
	}
}

Slack.prototype.chat = {
	postMessage: (body, channel) => {
		return this._makeRequest('chat.postMessage', {
			username: this._defaultUser,
			text: body
		});
	}
}


export default Slack;
