import type { Request, Response } from 'express';

export type MeQueryParameters = { readonly userId: string };

export type MeResponseBody = {
	readonly user?: {
		readonly email: string;
	};
	readonly authorizationEndpoint: string;
};

type MeRequestLocals = {
	readonly cloudId: string;
	readonly accountId: string;
};

export type MeRequest = Request<
	Record<string, never>,
	MeResponseBody,
	never,
	MeQueryParameters,
	MeRequestLocals
>;

export type MeResponse = Response<MeResponseBody, MeRequestLocals>;
