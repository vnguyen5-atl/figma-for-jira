/**
 * Identifies an Atlassian user within a specific Forge installation (per cloud).
 *
 * @remarks
 * Previously named `ConnectUserInfo`; the type has been kept under the same
 * filename for now to minimise churn, but `connectInstallationId` is replaced
 * with `cloudId`.
 */
export type ConnectUserInfo = {
	readonly atlassianUserId: string;
	readonly cloudId: string;
};
