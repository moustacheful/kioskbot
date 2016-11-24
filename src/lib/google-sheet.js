import google from 'googleapis';
import Promise from 'bluebird';
import { EventEmitter } from 'events';
import _ from 'lodash';
import Credential from 'src/models/credential';

const sheets = google.sheets('v4');
const drive = google.drive('v3');

Promise.promisifyAll(google.auth.OAuth2.prototype);
Promise.promisifyAll(sheets.spreadsheets.values);
Promise.promisifyAll(drive.revisions);

const oAuth = new google.auth.OAuth2(
	process.env.GOOGLE_CLIENT_ID,
	process.env.GOOGLE_CLIENT_SECRET,
	process.env.GOOGLE_CALLBACK
);

class GoogleSheet extends EventEmitter {
	constructor(){
		super();
		this.read = this.read.bind(this);
		this._queue = [];
		this._execQueue = _.debounce(this._execQueue, 5000).bind(this)
		this.getToken();
	}

	async getToken(){
		this.token = await Credential.for('google');
		oAuth.setCredentials(this.token);
		google.options({ auth: oAuth });
	}

	start(){
		setTimeout(this.read, 5000);
	}

	async read(){
		console.log('Reading');
		try {
			const [lastRevision, sheet] = [
				// Get latest revision
				await drive.revisions.listAsync({
					fileId: process.env.GSHEET,
					fields: 'revisions',
				}).then(res => res.revisions.pop()),

				 // Get current data
				await sheets.spreadsheets.values.getAsync({
					spreadsheetId: process.env.GSHEET,
					range: 'Inventario',
				}).then(res => res),
			];

			const labels = _.map(sheet.values.shift(), _.camelCase);
			const data = _.map(sheet.values, (row, i) => {
				row = _.take(row, labels.length);
				row = _.zipObject(labels, row);
				row.slug = _.kebabCase(row.item);
				row.index = i;
				return row;
			});


			this.emit('stockUpdated', data, lastRevision);
			return data;
		} catch (err){
			console.log('Google sheets fetch failed!:', err.message)
			console.error(err.stack);
		}
	}

	update(row, col, val) {
		const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		col = alphabet.substr(col,1);
		row = Number(row) + 2;
		const range = `Inventario!${col}${row}:${col}${row}`;
		this._queue.push({
			range,
			values: [[val]]
		});
		this._execQueue();
	}

	_execQueue(){
		sheets.spreadsheets.values.batchUpdateAsync({
			spreadsheetId: process.env.GSHEET,
			valueInputOption: 'USER_ENTERED',
			resource: {
				data: this._queue
			}
		});
		this._queue = [];
	}
};

export default new GoogleSheet();
