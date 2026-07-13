import { HttpStatusCode } from 'axios';
import { Router } from 'express';

import { adminRouter } from './admin';
import { authRouter } from './auth';
import { entitiesRouterV2 } from './entities-v2';
import { figmaRouter } from './figma';
import { lifecycleEventsRouter } from './lifecycle-events';
import { staticRouter } from './static';

export const rootRouter = Router();

// Healthcheck
rootRouter.get('/healthcheck', (_, res) => {
	res.status(HttpStatusCode.Ok).send('Server up and working.');
});

// Static resources (Figma OAuth result pages, etc.)
rootRouter.use('/static', staticRouter);

// Forge lifecycle events (proxied from the Forge function via Forge Remote)
rootRouter.use('/lifecycleEvents', lifecycleEventsRouter);

rootRouter.use('/admin', adminRouter);

rootRouter.use('/auth', authRouter);

rootRouter.use('/entities', entitiesRouterV2);

// Endpoints to handle requests from Figma
rootRouter.use('/figma', figmaRouter);
