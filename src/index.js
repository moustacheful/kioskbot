var path = require('path');
require('dotenv').config({ silent: true });
require('babel-register');
require('babel-polyfill');
require('app-module-path').addPath(process.cwd());
require('./app');