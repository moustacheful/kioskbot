var pm2 = require('pm2');

pm2.connect(function(){
	pm2.start({
		script: './src/index.js',
		instances: process.env.WEB_CONCURRENCY || 1,
		exec_mode: process.env.NODE_ENV === 'production' ? 'cluster' : 'fork',
		watch: process.env.NODE_ENV === 'development',
		kill_timeout: 5000
	}, function(err){
		if(err)
			return console.error('Error launching application.');

		// Display logs.
		pm2.launchBus(function(err, bus) {
			console.log('[PM2] Log streaming started');

			bus.on('log:out', function(packet) {
				console.log('[App:%s] %s', packet.process.name, packet.data);
			});

			bus.on('log:err', function(packet) {
				console.error('[App:%s][Err] %s', packet.process.name, packet.data);
			});
		});
	});
})
