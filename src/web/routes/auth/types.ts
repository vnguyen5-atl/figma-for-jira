import type { Request, Response } from 'express';

export type CheckAuthQueryParameters = { readonly userId: string };

export type CheckAuthResponseBody = {
	readonly type: '3LO';
	readonly authorized: boolean;
	readonly grant?: {
		readonly authorizationEndpoint: string;
	};
};

type CheckAuthRequestLocals = {
	readonly cloudId: string;
};

export type CheckAuthRequest = Request<
	Record<string, never>,
	CheckAuthResponseBody,
	never,
	CheckAuthQueryParameters,
	CheckAuthRequestLocals
>;

export type CheckAuthResponse = Response<
	CheckAuthResponseBody,
	CheckAuthRequestLocals
>;
