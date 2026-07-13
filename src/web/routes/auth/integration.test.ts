/**
 * Integration test stubs for `/auth/*` routes.
 *
 * The original Connect-era tests verified the Figma OAuth callback and
 * `/checkAuth` endpoints under Connect server-to-server JWT. After the Forge
 * migration these endpoints still exist but are FIT-authenticated; the tests
 * need to be rewritten in the same shape as
 * `src/web/routes/lifecycle-events/integration.test.ts`.
 *
 * See MIGRATION_PLAN.md "Integration test TODOs" for status.
 */

describe.skip('/auth (Forge Remote — TODO)', () => {
	describe('GET /callback', () => {
		it.todo(
			'persists Figma OAuth credentials when the OAuth state JWT is valid and Figma returns tokens',
		);
		it.todo('returns the success page on successful OAuth exchange');
		it.todo('returns the failure page when Figma rejects the code');
		it.todo('returns the failure page when the OAuth state JWT is invalid');
	});

	describe('GET /checkAuth', () => {
		it.todo(
			'returns authorized=true when the user has valid stored Figma credentials',
		);
		it.todo(
			'returns authorized=false + a Figma authorization URL when no credentials are stored',
		);
		it.todo('returns 401 when no FIT is provided');
	});
});
