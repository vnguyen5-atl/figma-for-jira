import { HttpStatusCode } from 'axios';
import type { NextFunction } from 'express';
import { Router } from 'express';

import { UNINSTALLED_FORGE_LIFECYCLE_EVENT_REQUEST_SCHEMA } from './schemas';
import type {
	ForgeLifecycleEventResponse,
	UninstalledForgeLifecycleEventRequest,
} from './types';

import { uninstalledUseCase } from '../../../usecases';
import { requestSchemaValidationMiddleware } from '../../middleware';
import { forgeInvocationTokenMiddleware } from '../../middleware/forge';

export const lifecycleEventsRouter = Router();

lifecycleEventsRouter.use(forgeInvocationTokenMiddleware);

/**
 * Handles the Forge "pre-uninstall" lifecycle event, forwarded from the Forge
 * function in `src/forge/pre-uninstall.ts`.
 *
 * @remarks
 * **Issue 1: An "Uninstall" event is not retryable**
 *
 * The Forge platform invokes pre-uninstall once with a 55-second timeout. To
 * mitigate risk of partial failure, the `uninstalledUseCase` is implemented
 * to be idempotent. Consider also using a queue (e.g., SQS) to retry handling
 * an event in case of failure.
 */
lifecycleEventsRouter.post(
	'/uninstalled',
	requestSchemaValidationMiddleware(
		UNINSTALLED_FORGE_LIFECYCLE_EVENT_REQUEST_SCHEMA,
	),
	(
		req: UninstalledForgeLifecycleEventRequest,
		res: ForgeLifecycleEventResponse,
		next: NextFunction,
	) => {
		const { cloudId } = req.body;
		uninstalledUseCase
			.execute(cloudId)
			.then(() => res.sendStatus(HttpStatusCode.NoContent))
			.catch(next);
	},
);
