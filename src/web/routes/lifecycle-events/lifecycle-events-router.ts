import { HttpStatusCode } from 'axios';
import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';

import type { JiraCallContext } from '../../../domain/entities';
import { uninstalledUseCase } from '../../../usecases';
import { UnauthorizedResponseStatusError } from '../../errors';
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
 *
 * The `cloudId`, `apiBaseUrl`, and `appSystemToken` come from the FIT and the
 * `x-forge-oauth-system` header (extracted by `forgeInvocationTokenMiddleware`),
 * not from the request body.
 */
lifecycleEventsRouter.post(
	'/uninstalled',
	(
		req: Request,
		res: Response<unknown, { jiraCallContext?: JiraCallContext }>,
		next: NextFunction,
	) => {
		const { jiraCallContext } = res.locals;
		if (!jiraCallContext) {
			return next(
				new UnauthorizedResponseStatusError(
					'Missing Jira call context (x-forge-oauth-system header).',
				),
			);
		}

		uninstalledUseCase
			.execute(jiraCallContext)
			.then(() => res.sendStatus(HttpStatusCode.NoContent))
			.catch(next);
	},
);

/**
 * Persists the freshest app system token for the current installation.
 *
 * Called periodically by the Forge `scheduledTrigger` function in
 * `src/forge/refresh-app-tokens.ts`. The actual persistence happens
 * inside `forgeInvocationTokenMiddleware`, so this handler is just a
 * 204 endpoint to give the trigger something to POST to.
 */
lifecycleEventsRouter.post('/refresh-app-token', (_req, res) => {
	res.sendStatus(HttpStatusCode.NoContent);
});
