import type { NextFunction } from 'express';
import { Router } from 'express';

import type { MeRequest, MeResponse } from './types';

import { buildAppUrl } from '../../../../config';
import { figmaAuthService } from '../../../../infrastructure/figma';
import { getCurrentFigmaUserUseCase } from '../../../../usecases';

export const authRouter = Router();

/**
 * Returns the current Figma user (if authenticated) and a Figma OAuth 2.0
 * authorization URL the admin can use to (re-)authenticate.
 */
authRouter.get(
	['/me'],
	function (req: MeRequest, res: MeResponse, next: NextFunction) {
		const { cloudId, accountId } = res.locals;

		getCurrentFigmaUserUseCase
			.execute(accountId, cloudId)
			.then((currentUser) => {
				const authorizationEndpoint =
					figmaAuthService.createOAuth2AuthorizationRequest({
						atlassianUserId: accountId,
						cloudId,
						redirectUrl: buildAppUrl('figma/oauth/callback'),
					});

				if (currentUser) {
					return res.send({
						user: { email: currentUser.email },
						authorizationEndpoint,
					});
				}

				return res.send({
					authorizationEndpoint,
				});
			})
			.catch((error) => next(error));
	},
);
