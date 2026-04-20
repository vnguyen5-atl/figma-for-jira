-- =============================================================================
-- Migration 2 of 2: Drop legacy `connect_installation_id` columns and the
-- `jira_connect_installation` table.
--
-- ⚠️  PREREQUISITES — DO NOT DEPLOY UNTIL ALL OF THE FOLLOWING ARE TRUE:
--
--   1. Migration 1 (`20260420000001_add_cloud_id`) is deployed.
--   2. The backfill script (`scripts/backfill-cloud-id.ts`) has run
--      successfully against this environment and all `cloud_id` columns are
--      fully populated. Verify with:
--        SELECT COUNT(*) FROM jira_figma_team WHERE cloud_id IS NULL;
--        SELECT COUNT(*) FROM jira_figma_oauth2_user_credentials WHERE cloud_id IS NULL;
--        SELECT COUNT(*) FROM jira_associated_figma_design WHERE cloud_id IS NULL;
--        SELECT COUNT(*) FROM jira_figma_file_webhook WHERE cloud_id IS NULL;
--      Each MUST return 0.
--   3. The application code that reads/writes `connect_installation_id` has
--      been replaced with code that reads/writes `cloud_id` — and that code
--      is deployed and serving production traffic without error.
--
-- This migration is DESTRUCTIVE and NOT REVERSIBLE.
-- =============================================================================

-- Make cloud_id NOT NULL on every table.
ALTER TABLE "jira_associated_figma_design" ALTER COLUMN "cloud_id" SET NOT NULL;
ALTER TABLE "jira_figma_oauth2_user_credentials" ALTER COLUMN "cloud_id" SET NOT NULL;
ALTER TABLE "jira_figma_team" ALTER COLUMN "cloud_id" SET NOT NULL;
ALTER TABLE "jira_figma_file_webhook" ALTER COLUMN "cloud_id" SET NOT NULL;

-- Drop legacy unique constraints that reference connect_installation_id.
ALTER TABLE "jira_associated_figma_design" DROP CONSTRAINT IF EXISTS "jira_associated_figma_design_file_key_node_id_associated-wit_key";
ALTER TABLE "jira_figma_oauth2_user_credentials" DROP CONSTRAINT IF EXISTS "jira_figma_oauth2_user_credentials_atlassian_user_id_connec_key";
ALTER TABLE "jira_figma_team" DROP CONSTRAINT IF EXISTS "jira_figma_team_team_id_connect_installation_id_key";
ALTER TABLE "jira_figma_file_webhook" DROP CONSTRAINT IF EXISTS "jira_figma_file_webhook_file_key_event_type_connect_install_key";

-- Add new unique constraints that reference cloud_id.
ALTER TABLE "jira_associated_figma_design" ADD CONSTRAINT "jira_associated_figma_design_file_key_node_id_associated-with-ari_cloud_id_key" UNIQUE ("file_key", "node_id", "associated-with-ari", "cloud_id");
ALTER TABLE "jira_figma_oauth2_user_credentials" ADD CONSTRAINT "jira_figma_oauth2_user_credentials_atlassian_user_id_cloud_id_key" UNIQUE ("atlassian_user_id", "cloud_id");
ALTER TABLE "jira_figma_team" ADD CONSTRAINT "jira_figma_team_team_id_cloud_id_key" UNIQUE ("team_id", "cloud_id");
ALTER TABLE "jira_figma_file_webhook" ADD CONSTRAINT "jira_figma_file_webhook_file_key_event_type_cloud_id_key" UNIQUE ("file_key", "event_type", "cloud_id");

-- Drop FK constraints first.
ALTER TABLE "jira_associated_figma_design" DROP CONSTRAINT IF EXISTS "jira_associated_figma_design_connect_installation_id_fkey";
ALTER TABLE "jira_figma_oauth2_user_credentials" DROP CONSTRAINT IF EXISTS "jira_figma_oauth2_user_credentials_connect_installation_id_fkey";
ALTER TABLE "jira_figma_team" DROP CONSTRAINT IF EXISTS "jira_figma_team_connect_installation_id_fkey";
ALTER TABLE "jira_figma_file_webhook" DROP CONSTRAINT IF EXISTS "jira_figma_file_webhook_connect_installation_id_fkey";

-- Drop legacy connect_installation_id columns.
ALTER TABLE "jira_associated_figma_design" DROP COLUMN "connect_installation_id";
ALTER TABLE "jira_figma_oauth2_user_credentials" DROP COLUMN "connect_installation_id";
ALTER TABLE "jira_figma_team" DROP COLUMN "connect_installation_id";
ALTER TABLE "jira_figma_file_webhook" DROP COLUMN "connect_installation_id";

-- Drop the legacy ConnectInstallation table.
DROP TABLE "jira_connect_installation";
