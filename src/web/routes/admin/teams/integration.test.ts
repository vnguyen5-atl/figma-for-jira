/**
 * Integration test stubs for `/admin/teams/*` routes.
 *
 * See `src/web/routes/admin/auth/integration.test.ts` and
 * MIGRATION_PLAN.md "Integration test TODOs" for context.
 */

describe.skip('/admin/teams (Forge Remote — TODO)', () => {
	describe('GET /', () => {
		it.todo('returns all Figma teams connected for the current cloud');
		it.todo('returns an empty array when no teams are connected');
		it.todo('returns 401 when the FIT claims isAdminUser=false');
		it.todo('returns 401 when no FIT is provided');
	});

	describe('POST /:teamId/connect', () => {
		it.todo(
			'creates a Figma webhook + persists a FigmaTeam record + sets the is-configured app property',
		);
		it.todo(
			'returns 402 when the Figma user does not have a paid plan (cannot create webhooks)',
		);
		it.todo(
			'returns 401 when the user has revoked Figma OAuth access (forwarded UnauthorizedFigmaServiceError)',
		);
		it.todo(
			'returns 401 when the FIT claims isAdminUser=false (non-admin Jira user)',
		);
	});

	describe('DELETE /:teamId/disconnect', () => {
		it.todo(
			'deletes the Figma webhook + the FigmaTeam record + clears the is-configured app property when no other team remains',
		);
		it.todo(
			'leaves the is-configured app property in place when at least one other connected team exists',
		);
		it.todo('returns 401 when the FIT claims isAdminUser=false');
	});
});
