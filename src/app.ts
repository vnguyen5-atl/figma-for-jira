// Must come before importing any instrumented module.
// eslint-disable-next-line import/no-unassigned-import
import './infrastructure/tracer';
import cors from 'cors';
import express, { json } from 'express';

import { getConfig } from './config';
import { errorHandlerMiddleware, httpLoggerMiddleware } from './web/middleware';
import { rootRouter } from './web/routes/router';

const app = express();

app.use(httpLoggerMiddleware);

// CORS — required because the Forge Custom UI iframe makes
// cross-origin browser fetches via @forge/bridge's `requestRemote`
// from `*.atlassian.net` (or `*.jira.com`) origins. Preflight
// OPTIONS requests do not carry the FIT, so they must succeed
// without authentication.
app.use(
	cors({
		// Reflect the request origin if it matches one of these patterns.
		// We allow any Atlassian site (the user's specific tenant origin)
		// and the standard *.jira-dev.com test environments.
		origin: [
			/\.atlassian\.net$/,
			/\.jira\.com$/,
			/\.jira-dev\.com$/,
		],
		credentials: true,
		// Allow the Authorization header so FITs can be sent on the
		// real (non-preflight) requests.
		allowedHeaders: ['Authorization', 'Content-Type'],
	}),
);

// Calling the express.json() method for parsing
app.use(json());

// Setting the routes
// Figma uses a base URL with a path for development purposes only.
app.use(getConfig().app.baseUrl.pathname, rootRouter);

// Error handling
app.use(errorHandlerMiddleware);

export default app;
