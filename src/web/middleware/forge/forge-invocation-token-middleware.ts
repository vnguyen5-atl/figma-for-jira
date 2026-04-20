import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { forgeInvocationTokenVerifier } from './forge-invocation-token-verifier';

import { getConfig } from '../../../config';
import { UnauthorizedResponseStatusError } from '../../errors';

/**
 * Authenticates requests from Forge using the Forge Invocation Token (FIT).
 *
 * On successful authentication, sets the following on `res.locals`:
 * - `cloudId` — the Jira site cloud ID
 * - `accountId` — the Atlassian account ID of the acting user (may be undefined for server-to-server calls)
 * - `isAdminUser` — whether the acting user is a Jira admin (may be undefined)
 *
 * @see https://developer.atlassian.com/platform/forge/remote/essentials/#the-forge-invocation-token-fit-
 */
export const forgeInvocationTokenMiddleware: RequestHandler = (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const authHeader = req.headers.authorization;

	if (!authHeader?.startsWith('Bearer ')) {
		return next(
			new UnauthorizedResponseStatusError('Missing Forge Invocation Token.'),
		);
	}

	const token = authHeader.slice('Bearer '.length);

	const appId = getConfig().app.id;

	void forgeInvocationTokenVerifier
		.verify(token, appId)
		.then(({ cloudId, accountId, isAdminUser }) => {
			res.locals.cloudId = cloudId;
			res.locals.accountId = accountId;
			res.locals.isAdminUser = isAdminUser;
			next();
		})
		.catch((e) =>
			next(new UnauthorizedResponseStatusError('Unauthorized.', undefined, e)),
		);
};
