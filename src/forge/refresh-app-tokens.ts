/**
 * Forge `scheduledTrigger` function — refreshes the persisted Jira app
 * system token for the current installation.
 *
 * @remarks
 * Forge fires this once per installation per scheduled interval (see
 * manifest `scheduledTrigger.figma-refresh-app-tokens.interval`). Each
 * invocation gets a fresh `x-forge-oauth-system` header for the current
 * installation; we POST that, the FIT, and the apiBaseUrl to the remote
 * backend, which persists them to the `jira_app_token` table for use by
 * the Figma webhook flow.
 *
 * @see MIGRATION_PLAN.md — Phase 5 "Open questions" for the unknowns.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const forgeApi = require('@forge/api') as {
	fetch: (
		url: string,
		init?: { method?: string; headers?: Record<string, string>; body?: string },
	) => Promise<{ ok: boolean; status: number }>;
};

/**
 * The remote backend URL is read from a Forge environment variable
 * (`forge variables set REMOTE_URL https://...`). Falls back to the
 * manifest remote `connect`'s baseUrl if not set, but for production
 * this should be set explicitly via `forge variables`.
 */
const REMOTE_URL: string = process.env['REMOTE_URL'] ?? '';

export const handler = async (): Promise<void> => {
	if (!REMOTE_URL) {
		console.warn('REMOTE_URL not set; skipping refresh-app-tokens trigger.');
		return;
	}

	// `forgeApi.fetch` automatically attaches the FIT and (when the remote
	// has appSystemToken enabled) the x-forge-oauth-system header to the
	// outbound request, so the remote middleware will persist them.
	const response = await forgeApi.fetch(
		`${REMOTE_URL}/lifecycleEvents/refresh-app-token`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		},
	);

	if (!response.ok) {
		console.error(`refresh-app-tokens: remote returned ${response.status}`);
	}
};
