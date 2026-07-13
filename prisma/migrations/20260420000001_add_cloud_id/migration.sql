-- =============================================================================
-- Migration 1 of 2: Add nullable `cloud_id` columns to all tables that
-- previously referenced `jira_connect_installation.id`.
--
-- This migration is ADDITIVE ONLY and SAFE TO DEPLOY against a running
-- production database. Existing application code that uses
-- `connect_installation_id` will continue to work after this migration.
--
-- After deploying this migration:
--   1. Run the backfill script: `npx ts-node scripts/backfill-cloud-id.ts`
--      The script reads each `jira_connect_installation` row and resolves
--      its real `cloudId` by calling `${baseUrl}/_edge/tenant_info`. The
--      resolved `cloudId` is then written to all related tables.
--   2. Verify all rows have `cloud_id` populated:
--        SELECT COUNT(*) FROM jira_figma_team WHERE cloud_id IS NULL;
--        SELECT COUNT(*) FROM jira_figma_oauth2_user_credentials WHERE cloud_id IS NULL;
--        SELECT COUNT(*) FROM jira_associated_figma_design WHERE cloud_id IS NULL;
--        SELECT COUNT(*) FROM jira_figma_file_webhook WHERE cloud_id IS NULL;
--      Each should return 0.
--   3. Deploy the migration `20260420000002_drop_connect_installation` to
--      drop the legacy `connect_installation_id` columns and the
--      `jira_connect_installation` table.
-- =============================================================================

ALTER TABLE "jira_associated_figma_design" ADD COLUMN "cloud_id" TEXT;
CREATE INDEX "jira_associated_figma_design_cloud_id_idx" ON "jira_associated_figma_design"("cloud_id");

ALTER TABLE "jira_figma_oauth2_user_credentials" ADD COLUMN "cloud_id" TEXT;
CREATE INDEX "jira_figma_oauth2_user_credentials_cloud_id_idx" ON "jira_figma_oauth2_user_credentials"("cloud_id");

ALTER TABLE "jira_figma_team" ADD COLUMN "cloud_id" TEXT;
CREATE INDEX "jira_figma_team_cloud_id_idx" ON "jira_figma_team"("cloud_id");

ALTER TABLE "jira_figma_file_webhook" ADD COLUMN "cloud_id" TEXT;
CREATE INDEX "jira_figma_file_webhook_cloud_id_idx" ON "jira_figma_file_webhook"("cloud_id");
