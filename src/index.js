require('dotenv').config({ silent: true });
if (process.env.NODE_ENV !== 'development') require('newrelic');
require('babel-register');
require('babel-polyfill');
require('app-module-path').addPath(process.cwd());
require('./app');
