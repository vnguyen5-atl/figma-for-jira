/**
 * Integration test stubs for `/admin/auth/*` routes.
 *
 * The original Connect-era tests have been moved to `describe.skip` blocks
 * because they were testing Connect JWT auth + Connect installation lookup
 * — concepts that no longer exist after the Forge migration.
 *
 * Each pending test below documents the behaviour that should be exercised
 * once the FIT-based version is written, mirroring the working pattern in
 * `src/web/routes/lifecycle-events/integration.test.ts`.
 *
 * See MIGRATION_PLAN.md "Integration test TODOs" for status.
 */

describe.skip('/admin/auth (Forge Remote — TODO)', () => {
	describe('GET /me', () => {
		it.todo(
			'returns user email + authorization endpoint when the user has valid Figma credentials',
		);
		it.todo(
			'refreshes Figma OAuth tokens transparently and returns user details when the stored token is expired',
		);
		it.todo(
			'returns an unauthorized response with the Figma authorization URL when no credentials are stored',
		);
		it.todo(
			'returns an unauthorized response when stored Figma credentials cannot be refreshed',
		);
		it.todo(
			'returns an unauthorized response when the Figma /me endpoint responds with 403',
		);
		it.todo(
			'returns an unauthorized response with the correct Figma authorization URL when nothing is stored',
		);
		it.todo(
			'returns 401 when the FIT claims isAdminUser=false (non-admin Jira user)',
		);
		it.todo('returns 401 when no FIT is provided');
	});
});
