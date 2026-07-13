/**
 * Integration test stubs for `/entities/*` routes (devops:designInfoProvider).
 *
 * The original Connect-era tests were the largest in the suite (~1160 lines)
 * and exercised the design-info provider flow end-to-end. They need to be
 * rewritten under FIT auth — see `src/web/routes/lifecycle-events/integration.test.ts`
 * for the working pattern.
 *
 * See MIGRATION_PLAN.md "Integration test TODOs" for status.
 */

describe.skip('/entities (Forge Remote — TODO)', () => {
	describe('POST /onEntityAssociated', () => {
		it.todo(
			'creates an associated Figma design record + submits the design to Jira + creates a Figma dev resource backlink',
		);
		it.todo(
			'creates Figma file webhooks for FILE_UPDATE and DEV_MODE_STATUS_UPDATE events the first time a design from a file is associated',
		);
		it.todo(
			'is idempotent — does not create duplicate webhooks when an additional design from the same file is associated',
		);
		it.todo(
			'gracefully handles the case where the user has no Figma credentials (skips the dev resource creation)',
		);
		it.todo('returns 400 when the design URL is malformed');
		it.todo('returns 401 when no FIT is provided');
	});

	describe('POST /onEntityDisassociated', () => {
		it.todo(
			'deletes the associated Figma design record + deletes the Figma dev resource backlink',
		);
		it.todo(
			'deletes Figma file webhooks when the last design for that file is disassociated',
		);
		it.todo(
			'leaves Figma file webhooks in place when other designs from the same file remain associated',
		);
		it.todo('returns 401 when no FIT is provided');
	});

	describe('POST /onEntitiesAssociatedWithEntity', () => {
		it.todo(
			'(if applicable for devops:designInfoProvider) — pending verification of the module contract',
		);
	});
});
