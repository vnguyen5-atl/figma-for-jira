import type { Request, Response } from 'express';

import type {
	FigmaTeamAuthStatus,
	FigmaTeamSummary,
	JiraCallContext,
} from '../../../../domain/entities';

export type ConnectFigmaTeamRouteParams = {
	readonly teamId: string;
};

type ConnectFigmaTeamLocals = {
	readonly cloudId: string;
	readonly accountId: string;
	readonly jiraCallContext: JiraCallContext;
};

export type ConnectFigmaTeamRequest = Request<
	ConnectFigmaTeamRouteParams,
	never,
	never,
	Record<string, never>,
	ConnectFigmaTeamLocals
>;

export type ConnectTeamResponseBody = {
	readonly teamId: string;
	readonly teamName: string;
	readonly authStatus: FigmaTeamAuthStatus;
};

export type ConnectFigmaTeamResponse = Response<
	ConnectTeamResponseBody,
	ConnectFigmaTeamLocals
>;

export type DisconnectFigmaTeamRouteParams = {
	readonly teamId: string;
};

export type DisconnectFigmaTeamLocals = {
	readonly cloudId: string;
	readonly accountId: string;
	readonly jiraCallContext: JiraCallContext;
};

export type DisconnectFigmaTeamRequest = Request<
	DisconnectFigmaTeamRouteParams,
	never,
	never,
	Record<string, never>,
	DisconnectFigmaTeamLocals
>;

export type DisconnectFigmaTeamResponse = Response<
	never,
	DisconnectFigmaTeamLocals
>;

export type ListFigmaTeamsLocals = {
	readonly cloudId: string;
};

export type ListFigmaTeamsResponseBody = ReadonlyArray<FigmaTeamSummary>;

export type ListFigmaTeamsResponse = Response<
	ListFigmaTeamsResponseBody,
	ListFigmaTeamsLocals
>;
