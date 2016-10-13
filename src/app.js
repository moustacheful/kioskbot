import Koa from 'koa';
import Router from 'koa-router';
import ErrorHandler from 'src/middleware/error-handler';
import auth from 'src/routes/auth';
import slack from 'src/routes/slack';

const app = new Koa();

// Middleware
app.use(ErrorHandler);

// Routes
auth(app);
slack(app);

app.listen(process.env.PORT || 5000);
console.log('App running');
export default app;
