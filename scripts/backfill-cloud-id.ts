/* eslint-disable no-console */

/**
 * =============================================================================
 * Cloud ID backfill script
 * =============================================================================
 *
 * Resolves the real Atlassian `cloudId` for each existing
 * `jira_connect_installation` row, then propagates it to all related tables
 * (`jira_figma_team`, `jira_figma_oauth2_user_credentials`,
 *  `jira_associated_figma_design`, `jira_figma_file_webhook`).
 *
 * This script is part of the Connect → Forge migration. It must be run
 * AFTER migration `20260420000001_add_cloud_id` has been deployed and BEFORE
 * migration `20260420000002_drop_connect_installation` is deployed.
 *
 * Production runbook
 * ------------------
 *   1. Deploy migration `20260420000001_add_cloud_id` (additive, safe).
 *   2. Run this script against the production database:
 *        DATABASE_URL=<prod url> npx ts-node scripts/backfill-cloud-id.ts
 *      The script is idempotent — rows with `cloud_id` already populated
 *      are skipped, so it can be safely re-run if interrupted.
 *   3. Verify all rows have `cloud_id` populated:
 *        SELECT COUNT(*) FROM jira_figma_team WHERE cloud_id IS NULL;
 *        SELECT COUNT(*) FROM jira_figma_oauth2_user_credentials WHERE cloud_id IS NULL;
 *        SELECT COUNT(*) FROM jira_associated_figma_design WHERE cloud_id IS NULL;
 *        SELECT COUNT(*) FROM jira_figma_file_webhook WHERE cloud_id IS NULL;
 *      Each MUST return 0.
 *   4. Deploy the new application code that reads/writes `cloud_id`.
 *   5. Deploy migration `20260420000002_drop_connect_installation` to remove
 *      the legacy `connect_installation_id` columns and table.
 *
 * How cloudId is resolved
 * -----------------------
 * For each `jira_connect_installation`, this script calls
 * `${baseUrl}/_edge/tenant_info` (a public Atlassian endpoint) which returns
 * `{ cloudId: string }` for the corresponding Jira site.
 *
 * If a tenant_info call fails (network error, site unreachable, site
 * uninstalled), the row is skipped and logged. Re-run the script after
 * resolving the underlying issue.
 * =============================================================================
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

interface TenantInfoResponse {
	cloudId: string;
}

async function resolveCloudId(baseUrl: string): Promise<string> {
	const url = new URL('/_edge/tenant_info', baseUrl).toString();
	const response = await axios.get<TenantInfoResponse>(url, {
		timeout: 10_000,
	});
	if (!response.data?.cloudId) {
		throw new Error(`tenant_info returned no cloudId for ${baseUrl}`);
	}
	return response.data.cloudId;
}

async function main() {
	console.log('Starting cloudId backfill...');

	// We use raw SQL because the Prisma schema no longer models
	// `ConnectInstallation` — but the table still exists in the DB at this
	// point in the migration timeline.
	const installations = await prisma.$queryRaw<
		Array<{ id: bigint; client_key: string; base_url: string }>
	>`SELECT id, client_key, base_url FROM jira_connect_installation`;

	console.log(`Found ${installations.length} ConnectInstallation rows.`);

	let succeeded = 0;
	let skipped = 0;
	let failed = 0;

	for (const installation of installations) {
		const installationId = installation.id;
		const baseUrl = installation.base_url;

		try {
			const cloudId = await resolveCloudId(baseUrl);

			console.log(
				`[${installationId}] ${baseUrl} → cloudId=${cloudId} — backfilling...`,
			);

			await prisma.$transaction([
				prisma.$executeRaw`
					UPDATE jira_associated_figma_design
					SET cloud_id = ${cloudId}
					WHERE connect_installation_id = ${installationId} AND cloud_id IS NULL
				`,
				prisma.$executeRaw`
					UPDATE jira_figma_oauth2_user_credentials
					SET cloud_id = ${cloudId}
					WHERE connect_installation_id = ${installationId} AND cloud_id IS NULL
				`,
				prisma.$executeRaw`
					UPDATE jira_figma_team
					SET cloud_id = ${cloudId}
					WHERE connect_installation_id = ${installationId} AND cloud_id IS NULL
				`,
				prisma.$executeRaw`
					UPDATE jira_figma_file_webhook
					SET cloud_id = ${cloudId}
					WHERE connect_installation_id = ${installationId} AND cloud_id IS NULL
				`,
			]);

			succeeded++;
		} catch (err) {
			console.error(
				`[${installationId}] ${baseUrl} — FAILED:`,
				err instanceof Error ? err.message : err,
			);
			failed++;
		}
	}

	skipped = installations.length - succeeded - failed;

	console.log('---');
	console.log(`Backfill complete.`);
	console.log(`  Succeeded: ${succeeded}`);
	console.log(`  Failed:    ${failed}`);
	console.log(`  Skipped:   ${skipped}`);

	if (failed > 0) {
		console.error(
			'\n⚠️  Some installations failed to backfill. Resolve the underlying issues and re-run this script (it is idempotent).',
		);
		process.exitCode = 1;
	}
}

main()
	.catch((e) => {
		console.error(e);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
