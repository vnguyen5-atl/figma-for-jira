import { HttpStatusCode } from 'axios';
import type { NextFunction, Request } from 'express';
import { Router } from 'express';

import type {
	ConnectFigmaTeamRequest,
	ConnectFigmaTeamResponse,
	DisconnectFigmaTeamRequest,
	DisconnectFigmaTeamResponse,
	ListFigmaTeamsResponse,
} from './types';

import {
	connectFigmaTeamUseCase,
	disconnectFigmaTeamUseCase,
	listFigmaTeamsUseCase,
} from '../../../../usecases';

export const teamsRouter = Router();

teamsRouter.get(
	'/',
	(req: Request, res: ListFigmaTeamsResponse, next: NextFunction) => {
		const { cloudId } = res.locals;

		listFigmaTeamsUseCase
			.execute(cloudId)
			.then((teams) => res.status(HttpStatusCode.Ok).send(teams))
			.catch(next);
	},
);

teamsRouter.post(
	'/:teamId/connect',
	(
		req: ConnectFigmaTeamRequest,
		res: ConnectFigmaTeamResponse,
		next: NextFunction,
	) => {
		const { accountId, cloudId } = res.locals;

		connectFigmaTeamUseCase
			.execute(req.params.teamId, accountId, cloudId)
			.then((figmaTeamSummary) =>
				res.status(HttpStatusCode.Ok).send(figmaTeamSummary),
			)
			.catch(next);
	},
);

teamsRouter.delete(
	'/:teamId/disconnect',
	(
		req: DisconnectFigmaTeamRequest,
		res: DisconnectFigmaTeamResponse,
		next: NextFunction,
	) => {
		const { cloudId } = res.locals;

		disconnectFigmaTeamUseCase
			.execute(req.params.teamId, cloudId)
			.then(() => res.sendStatus(HttpStatusCode.Ok))
			.catch(next);
	},
);
