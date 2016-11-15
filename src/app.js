import Koa from 'koa';
import Router from 'koa-router';
import ErrorHandler from 'src/middleware/error-handler';
import auth from 'src/routes/auth';
import slack from 'src/routes/slack';
import common from 'src/routes/common';
import 'src/lib/mongodb';

// Create the app instance
const app = new Koa();

// Middleware
app.use(ErrorHandler);

// Routes
auth(app);
slack(app);
common(app);

app.listen(process.env.PORT || 5000);
console.log('App running');
export default app;
