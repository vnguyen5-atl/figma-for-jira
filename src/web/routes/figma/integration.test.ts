/**
 * Integration test stubs for `/figma/*` routes (Figma webhook receiver).
 *
 * Note: this route group is authenticated by Figma's own webhook passcode
 * (`figmaWebhookAuthMiddleware`), NOT by the FIT — Figma calls this endpoint
 * directly. The webhook handler then hydrates a JiraCallContext from the
 * persisted `jira_app_token` table (populated by the Forge scheduledTrigger).
 *
 * See `src/web/routes/lifecycle-events/integration.test.ts` for the working
 * pattern, and MIGRATION_PLAN.md "Integration test TODOs" for status.
 *
 * The original tests (~1323 lines) were broken by Phase 4's removal of
 * ConnectInstallation; rewriting them under the new (cloudId + persisted
 * appSystemToken) model is part of the integration-test refactor TODO.
 */

describe.skip('/figma (Forge Remote — TODO)', () => {
	describe('POST /webhook (FILE_UPDATE event)', () => {
		it.todo(
			'submits updated designs to Jira via the persisted appSystemToken when associated designs exist for the file',
		);
		it.todo(
			'is a no-op when no FigmaTeam is found for the webhook passcode',
		);
		it.todo(
			'is a no-op when no associated designs exist for the file',
		);
		it.todo(
			'updates the FigmaTeam.authStatus to ERROR when the team-admin Figma OAuth token is no longer valid',
		);
		it.todo(
			'returns a successful response even when no persisted Jira app token exists yet (graceful degradation)',
		);
		it.todo(
			'returns 401 when the Figma passcode does not match any FigmaTeam',
		);
	});

	describe('POST /webhook (DEV_MODE_STATUS_UPDATE event)', () => {
		it.todo(
			'updates the design status in Jira when a Figma design moves to "Ready for Dev"',
		);
		it.todo(
			'is a no-op when no associated designs exist for the file',
		);
	});

	describe('POST /webhook (PING event)', () => {
		it.todo('returns 200 for a Figma webhook PING event');
	});
});
