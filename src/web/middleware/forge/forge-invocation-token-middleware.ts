import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { forgeInvocationTokenVerifier } from './forge-invocation-token-verifier';

import { getConfig } from '../../../config';
import type { JiraCallContext } from '../../../domain/entities';
import { getLogger } from '../../../infrastructure';
import { jiraAppTokenRepository } from '../../../infrastructure/repositories';
import { UnauthorizedResponseStatusError } from '../../errors';

/**
 * The header name Forge uses to send the app system token to the remote
 * backend. Present iff `auth.appSystemToken.enabled: true` is set on the
 * remote in the manifest, AND the `read:app-system-token` scope is granted.
 *
 * @see https://developer.atlassian.com/platform/forge/remote/essentials/
 */
const APP_SYSTEM_TOKEN_HEADER = 'x-forge-oauth-system';

/**
 * Authenticates requests from Forge using the Forge Invocation Token (FIT).
 *
 * On successful authentication, sets the following on `res.locals`:
 * - `cloudId` — the Jira site cloud ID
 * - `accountId` — the Atlassian account ID of the acting user (may be undefined for server-to-server calls)
 * - `isAdminUser` — whether the acting user is a Jira admin (may be undefined)
 * - `jiraCallContext` — the bundle `(cloudId, apiBaseUrl, appSystemToken)` to pass to outbound Jira calls
 *
 * @see https://developer.atlassian.com/platform/forge/remote/essentials/
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

	const appSystemTokenHeader = req.headers[APP_SYSTEM_TOKEN_HEADER];
	const appSystemToken = Array.isArray(appSystemTokenHeader)
		? appSystemTokenHeader[0]
		: appSystemTokenHeader;

	const appId = getConfig().app.id;

	void forgeInvocationTokenVerifier
		.verify(token, appId)
		.then(async ({ cloudId, accountId, isAdminUser, apiBaseUrl, exp }) => {
			res.locals.cloudId = cloudId;
			res.locals.accountId = accountId;
			res.locals.isAdminUser = isAdminUser;

			if (typeof appSystemToken === 'string' && appSystemToken.length > 0) {
				const jiraCallContext: JiraCallContext = {
					cloudId,
					apiBaseUrl,
					appSystemToken,
				};
				res.locals.jiraCallContext = jiraCallContext;

				// Persist the freshest token for use by background flows
				// (e.g. Figma webhooks) that don't have an inbound FIT.
				// Best-effort: never block the request on a persistence error.
				try {
					await jiraAppTokenRepository.upsert({
						cloudId,
						apiBaseUrl,
						appSystemToken,
						expiresAt: new Date(exp * 1000),
					});
				} catch (e: unknown) {
					getLogger().warn(
						e,
						`Failed to persist Jira app token for cloudId ${cloudId}.`,
					);
				}
			}

			next();
		})
		.catch((e) =>
			next(new UnauthorizedResponseStatusError('Unauthorized.', undefined, e)),
		);
};
