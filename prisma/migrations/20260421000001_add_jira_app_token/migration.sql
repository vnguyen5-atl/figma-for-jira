-- Phase 5: persist Forge app system tokens per cloudId so the Figma
-- webhook flow (which has no inbound FIT) can call Jira APIs.

CREATE TABLE "jira_app_token" (
    "id" BIGSERIAL NOT NULL,
    "cloud_id" TEXT NOT NULL,
    "api_base_url" TEXT NOT NULL,
    "app_system_token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "jira_app_token_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "jira_app_token_cloud_id_key" ON "jira_app_token" ("cloud_id");
