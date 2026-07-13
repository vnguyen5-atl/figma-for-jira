/**
 * Identifies an Atlassian user within a specific cloud (Forge installation).
 */
export type AtlassianUserInfo = {
	readonly atlassianUserId: string;
	readonly cloudId: string;
};
