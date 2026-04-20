import { view } from '@forge/bridge';

/**
 * Returns the current user's Atlassian Account ID. Sourced from the Forge
 * Custom UI bridge `view.getContext()` (replaces the legacy Connect
 * `AP.user.getCurrentUser` callback).
 */
export async function getAtlassianAccountId(): Promise<string> {
	const context = await view.getContext();
	const accountId = (context as { accountId?: string }).accountId;
	if (!accountId) {
		throw new Error(
			'Forge view.getContext() did not return an accountId — admin UI cannot proceed.',
		);
	}
	return accountId;
}

/**
 * Returns the host of the current Atlassian site (e.g. `mycompany.atlassian.net`).
 * Sourced from the Forge Custom UI bridge `view.getContext()` (replaces the
 * legacy Connect `AP.getLocation` callback).
 */
export async function getCurrentAtlassianSite(): Promise<string> {
	const context = await view.getContext();
	const siteUrl = (context as { siteUrl?: string }).siteUrl;
	if (!siteUrl) {
		throw new Error(
			'Forge view.getContext() did not return a siteUrl — cannot determine the current Atlassian site.',
		);
	}
	try {
		return new URL(siteUrl).host;
	} catch {
		// Fall back to returning the raw value if it isn't a valid URL.
		return siteUrl;
	}
}
