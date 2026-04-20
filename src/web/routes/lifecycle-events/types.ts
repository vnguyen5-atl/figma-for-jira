import type { Request, Response } from 'express';

/**
 * Body of the uninstalled lifecycle event POSTed by the Forge `pre-uninstall`
 * function to this remote backend.
 */
export type UninstalledForgeLifecycleEventRequestBody = {
	readonly cloudId: string;
};

export type UninstalledForgeLifecycleEventRequest = Request<
	Record<string, never>,
	never,
	UninstalledForgeLifecycleEventRequestBody,
	Record<string, never>,
	Record<string, never>
>;

export type ForgeLifecycleEventResponse = Response<
	never,
	Record<string, never>
>;
