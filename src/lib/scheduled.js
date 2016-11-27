import _ from 'lodash';
import schedule from 'node-schedule';
import reminder from 'src/lib/tasks/reminder';
import keepAwake from 'src/lib/tasks/keep-awake';
import updateUsers from 'src/lib/tasks/update-users';

const tasks = [
	{ rule: '0 11 * * 1-5', fn: reminder }, // Every weekday at 11 am
	{ rule: '* * * * 1-5', fn: keepAwake }, // Every minute on weekdays
	{ rule: '0 */1 * * 1-5', fn: updateUsers }, // Every hour on weekdays
];

//_.forEach(tasks, task => schedule.scheduleJob(task.rule, task.fn));
