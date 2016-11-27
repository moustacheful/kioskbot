import fetch from 'node-fetch';
import schedule from 'node-schedule';


export default () => {
	fetch(process.env.BASE_URL + '/heartbeat')
};
