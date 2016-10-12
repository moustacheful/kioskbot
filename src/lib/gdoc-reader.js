import google from 'googleapis';
import Promise from 'bluebird';
import { EventEmitter } from 'events';
import _ from 'lodash';
import uuid from 'uuid';
import redis from './redis';

const sheets = google.sheets('v4');
const drive = google.drive('v3');

Promise.promisifyAll(google.auth.OAuth2.prototype);
Promise.promisifyAll(sheets.spreadsheets.values);
Promise.promisifyAll(drive.files);
Promise.promisifyAll(drive.revisions);
Promise.promisifyAll(drive.changes);

const oAuth = new google.auth.OAuth2(
	process.env.GOOGLE_CLIENT_ID,
	process.env.GOOGLE_CLIENT_SECRET,
	process.env.GOOGLE_CALLBACK
);

class GDocReader extends EventEmitter {
	constructor(){
		super();
		console.log('gdoc reader started');
		this.read = this.read.bind(this);
		this.getToken();
		this.start();
	}
	
	async setup(){
		await this.getToken();
		const channelId = uuid.v4();
		const watchResponse = await drive.files.watchAsync({
			auth: oAuth,
			fileId: process.env.GSHEET,
			resource: {
				id: channelId,
				type: 'web_hook',
				address: `${process.env.BASE_URL}/incoming`,
			}
		});
		await redis.setAsync('app:gsheet-channel', channelId);
		console.log(watchResponse)
	}

	async getToken(){
		this.token = await redis.getAsync('token:google');
		oAuth.setCredentials(JSON.parse(this.token));
		google.options({ auth: oAuth });
	}

	start(){

		//setTimeout(this.read, 5000);
	}

	async read(){
		try {
			const [lastRevision, sheet] = [
				// Get latest revision
				await drive.revisions.listAsync({
					fileId: process.env.GSHEET,
					fields: 'revisions',
				}).spread(res => res.revisions.pop()),

				 // Get current data
				await sheets.spreadsheets.values.getAsync({
					spreadsheetId: process.env.GSHEET,
					range: 'Inventario',
				}).spread(res => res),
			];
			const newSheet = JSON.parse(JSON.stringify(sheet));

			newSheet.values = _.map(newSheet.values, (row, i) => {
				if(i==0) return row;
				const newRow =  [...row];
				newRow[2] = Number(newRow[2]) + 15;
				return newRow;
			});
			/*
			newSheet.range = "Inventario!A1:C10"
			delete newSheet.majorDimension
			console.log(newSheet);


			const a = await sheets.spreadsheets.values.updateAsync({
				spreadsheetId: process.env.GSHEET,
				range: newSheet.range,
				valueInputOption: 'USER_ENTERED',
				resource: newSheet
			}).spread(res => res);

			console.log(a)
			return;
			*/

			const labels = _.map(sheet.values.shift(), _.snakeCase);
			const data = _.map(sheet.values, (row, i) => {
				row = _.take(row, labels.length);
				row = _.zipObject(labels, row);
				row.slug = _.kebabCase(row.item);
				row.index = i;
				return row;	
			});

			this.emit('stockUpdated', data, lastRevision);		
		} catch (err){
			console.log('Google sheets fetch failed!:', err.message)
		}
	}
};

export default new GDocReader();
