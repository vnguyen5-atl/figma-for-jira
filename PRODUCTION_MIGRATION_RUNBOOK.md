# Production Migration Runbook — Connect → Forge

**Audience:** Figma for Jira app maintainer / SRE  
**Goal:** Migrate the production deployment of Figma for Jira from a Jira
Connect app to a Forge Remote app, with zero data loss for existing
Marketplace customers.

> **Read this whole document before doing anything.** Several steps have
> sequencing constraints; running them in the wrong order can corrupt
> data or break customer installations.

---

## 0. Prerequisites & one-time setup

### 0.1 Tools

```bash
npm install -g @forge/cli      # ≥ 8.x
docker --version               # for local + production DB ops
psql --version                 # for production DB verification
```

### 0.2 Forge access

- Atlassian developer account with permission to publish Marketplace
  apps (or a separate Forge organization for the new Forge variant).
- Atlassian CLI logged in: `forge login`.

### 0.3 Production credentials needed

- Production Postgres connection string (`DATABASE_URL`) — read/write.
- Production remote backend deployment credentials (whatever your
  current hosting flow uses to ship the Express server).
- Production Figma OAuth client ID/secret (existing — does **not**
  change in this migration).

### 0.4 Backups

- ⚠️ Take a verified Postgres backup of production **before** running
  any of the migration SQL. Confirm you can restore it to a scratch
  instance.

---

## 1. ⚠️ The customer migration question (READ FIRST)

This app has **existing Marketplace customers** running it as a Connect
app. There are two fundamentally different ways to migrate them:

### Option 1A — Hard cutover (what this migration plan currently assumes)

- Publish a new Forge app version on the Marketplace.
- Each existing customer **uninstalls the Connect app and installs the
  Forge app**.
- The backfill script (Section 4) populates the `cloud_id` columns for
  the existing rows so customer data survives the cutover, but
  **customers must perform the uninstall/install themselves**.
- Pros: clean architecture; no Connect bridge code to maintain.
- Cons: requires a customer migration campaign; customers experience
  downtime between uninstall and reinstall.

### Option 1B — Connect→Forge bridge (NOT currently implemented)

- The Forge manifest gets a `connect:` block declaring the existing
  Connect app key + descriptor URL. Forge then auto-converts existing
  Connect installations into Forge installations transparently.
- This was explicitly **removed** from `manifest.yml` during Phase 1 of
  this migration (per the app owner's request to go fully Forge).
- If hard cutover is unacceptable, the `connect:` block needs to be
  added back. See:
  https://developer.atlassian.com/platform/forge/connect-on-forge/

> ❗ **Decide between 1A and 1B before proceeding.** The rest of this
> runbook assumes 1A. If you choose 1B, the manifest needs changes and
> the customer-side steps (Section 7) become a no-op.

---

## 2. Pre-migration: register the Forge app

These steps happen on your local machine.

```bash
# From the repo root
forge register
```

`forge register` will:

- Prompt for a name (use the production name, e.g. "Figma for Jira").
- Generate a unique app ID (`ari:cloud:ecosystem::app/<UUID>`).
- Update `manifest.yml` `app.id` automatically.

**Capture the app ID.** It needs to be set in:

- `manifest.yml` → `app.id` (forge register does this for you)
- Production remote backend `FORGE_APP_ID` env var (manual)
- Test/staging remote backend `FORGE_APP_ID` env var (manual)

---

## 3. Database migration — Stage 1 (additive, safe)

This stage adds nullable `cloud_id` columns alongside existing
`connect_installation_id` foreign keys. The old code keeps working;
the new columns sit unused until Stage 2.

### 3.1 Apply migration `20260420000001_add_cloud_id`

```bash
DATABASE_URL=<prod-readwrite-url> npx prisma migrate deploy
```

This applies **all unapplied migrations including the additive one and
the `jira_app_token` table creation**. Specifically these run:

- `20260420000001_add_cloud_id` — adds nullable `cloud_id` to:
  - `jira_associated_figma_design`
  - `jira_figma_oauth2_user_credentials`
  - `jira_figma_team`
  - `jira_figma_file_webhook`
- `20260421000001_add_jira_app_token` — creates the new `jira_app_token`
  table used by the Phase 5 webhook flow.

`20260420000002_drop_connect_installation` is **also pending** but you
DO NOT run it yet. (Prisma applies migrations in chronological order —
see Section 5 for how to run only this one separately.)

### 3.2 Verify

```sql
-- All four tables should have a nullable cloud_id column.
\d jira_associated_figma_design
\d jira_figma_oauth2_user_credentials
\d jira_figma_team
\d jira_figma_file_webhook

-- The jira_app_token table should exist and be empty.
SELECT COUNT(*) FROM jira_app_token;  -- expect 0

-- The jira_connect_installation table should still exist and be
-- populated (unchanged at this point).
SELECT COUNT(*) FROM jira_connect_installation;
```

> ⚠️ **STOP if `prisma migrate deploy` somehow ran the destructive
> Stage-2 migration too.** Restore from backup. The expected state is:
> Stage 1 applied, Stage 2 pending.

---

## 4. Backfill `cloud_id` for existing rows

The backfill script reads each `jira_connect_installation` row, calls
the Atlassian `_edge/tenant_info` endpoint on its `base_url` to resolve
the actual `cloudId`, then propagates it to all related tables.

### 4.1 Network requirements

The script must be able to reach `https://*.atlassian.net/_edge/tenant_info`
from wherever you run it. If your production DB is behind a VPN, run
the script from a host inside that network (e.g. a bastion or CI
runner) and either:

- Tunnel from that host to the public internet (preferred), OR
- Run the script in two passes: collect `(installationId, baseUrl)` →
  resolve cloudIds offline (via your laptop) → write them back via SQL.

### 4.2 Run

```bash
DATABASE_URL=<prod-readwrite-url> npx ts-node scripts/backfill-cloud-id.ts
```

The script is **idempotent** — rows where `cloud_id` is already set are
skipped. Safe to re-run if interrupted.

Output looks like:

```
Starting cloudId backfill...
Found 1234 ConnectInstallation rows.
[1] https://acme.atlassian.net → cloudId=abc-123 — backfilling...
[2] https://foo.atlassian.net → cloudId=def-456 — backfilling...
...
Done. succeeded=1232, skipped=1, failed=1
```

### 4.3 Investigate failures

Common failure modes:

- **`tenant_info returned no cloudId`** — the customer site is gone
  (uninstalled, suspended, or migrated to a different cloud). Decide
  whether to delete those rows or leave them stranded.
- **Network timeout** — re-run; the script is idempotent.

### 4.4 Verify completeness

```sql
SELECT 'design'   AS t, COUNT(*) FROM jira_associated_figma_design        WHERE cloud_id IS NULL
UNION ALL
SELECT 'creds'    AS t, COUNT(*) FROM jira_figma_oauth2_user_credentials  WHERE cloud_id IS NULL
UNION ALL
SELECT 'team'     AS t, COUNT(*) FROM jira_figma_team                     WHERE cloud_id IS NULL
UNION ALL
SELECT 'webhook'  AS t, COUNT(*) FROM jira_figma_file_webhook             WHERE cloud_id IS NULL;
```

**All four counts MUST be 0** before proceeding to Section 5.

If any are non-zero, those rows correspond to ConnectInstallations that
the script couldn't resolve a cloudId for. Either:

- Triage and resolve manually, OR
- Delete the orphaned rows (only if you're sure they're unrecoverable):
  ```sql
  DELETE FROM jira_associated_figma_design WHERE cloud_id IS NULL;
  -- ... repeat for the other 3 tables
  ```

---

## 5. Deploy the new application code

At this point the database has `cloud_id` populated everywhere, but the
production Express backend is still running the old Connect-based code
that reads `connect_installation_id`. We now switch to the new code
that reads `cloud_id`.

### 5.1 Build and deploy the remote backend

The remote backend deployment process is whatever you currently use
(Docker image push + container restart, etc.). The new image must:

- Have these env vars set:
  - `FORGE_APP_ID=<app id from Section 2>`
  - `DATABASE_URL=<prod>` (unchanged)
  - All existing Figma OAuth env vars (unchanged)
  - `JIRA_CONNECT_KEY_SERVER_URL` and `APP_KEY` env vars are no longer
    required but are harmless if left in place
- Have `admin/dist/` built into the image (the Dockerfile already does
  `RUN npm run build` which builds both the backend and the admin SPA).
- Be reachable from the public internet at a stable HTTPS URL — this
  becomes the `remotes[0].baseUrl` in your `manifest.yml`.

### 5.2 Update `manifest.yml` for production

```yaml
remotes:
  - key: connect # historical name — keep stable
    baseUrl: https://your-production-remote-url.example.com # ← UPDATE THIS
```

Also update the `logoUrl` if it points at the dev tunnel:

```yaml
modules:
  devops:designInfoProvider:
    - logoUrl: https://your-production-remote-url.example.com/static/figma-logo.svg
```

Commit this change to source control.

### 5.3 Deploy the Forge app to production environment

```bash
# Build the admin Custom UI bundle so dist/ is fresh
cd admin && npm run build && cd ..

# Push the manifest + admin/dist to Forge
forge deploy --environment production
```

This uploads:

- The manifest (modules, scopes, remote URL, scheduled triggers)
- The Forge functions (`pre-uninstall.ts`, `refresh-app-tokens.ts`)
- The admin Custom UI static assets (`admin/dist`)

### 5.4 Smoke-check the new code

Hit the remote backend's health endpoint or run a manual ping. Watch
the logs to confirm requests are succeeding (should be quiet — no
inbound traffic until customers install).

---

## 6. Database migration — Stage 2 (destructive, irreversible)

⚠️ **Only run this after the new code is verified working in production
for an agreed bake-in period (recommend ≥ 24 hours).** Once you drop
the `jira_connect_installation` table you cannot roll back to the old
code without restoring from backup.

### 6.1 Apply migration `20260420000002_drop_connect_installation`

If you only have this one migration left pending:

```bash
DATABASE_URL=<prod-readwrite-url> npx prisma migrate deploy
```

It will:

- Drop the `connect_installation_id` foreign key columns from all four
  related tables
- Drop the `jira_connect_installation` table itself

### 6.2 Verify

```sql
-- These should all error with "relation does not exist":
SELECT * FROM jira_connect_installation LIMIT 1;
\d jira_connect_installation
```

---

## 7. Customer migration

> ⚠️ Skip this section if you chose Option 1B (Connect→Forge bridge).

For each existing customer:

1. They uninstall the Connect app via Manage Apps in Jira.
2. They install the new Forge app (your Marketplace listing now points
   at the new Forge app, OR they install via a private link if doing a
   staged rollout).
3. The `installed` lifecycle event no longer exists in Forge — there's
   no automatic per-install setup needed; the data is already in the
   DB keyed by `cloud_id`.
4. The customer reconfigures any Figma teams via the admin UI if
   needed (existing `figma_team` rows survive because they're keyed by
   `cloud_id`).

**Communications:** prepare a customer email + in-product banner
explaining the migration, the brief downtime window, and any action
required.

---

## 8. Post-migration verification

For each smoke-tested customer site:

- [ ] Admin Custom UI loads via Apps → Manage your apps → Figma for
      Jira → Configure
- [ ] At least one Figma team is connected and shown as authorized
- [ ] On a test Jira issue, linking a Figma design via the Designs
      panel succeeds (devops:designInfoProvider GET works)
- [ ] After updating a node in Figma, the design data in Jira refreshes
      within a few minutes (Figma webhook → persisted system token →
      Jira submit)
- [ ] Uninstalling the app cleans up the database rows for that
      `cloud_id` and removes the Figma webhooks (`preUninstall` →
      `uninstalledUseCase`)

---

## 9. Open questions & known unknowns

These are explicitly NOT validated in code and need confirmation
during/after deployment:

| # | Open question | Mitigation |
|---|---|---|
| 1 | `devops:designInfoProvider` — undocumented module schema may have additional required fields | If `forge deploy` validates the manifest, fix any errors it reports. If runtime errors appear, file a Forge support ticket. |
| 2 | `POST /rest/designs/1.0/bulk` may need a scope beyond `read:jira-work` | If 403s appear in production logs, add the missing scope and re-publish |
| 3 | `view.getContext()` doesn't return `isAdminUser` — admin UI relies on backend rejecting non-admin users | Verify a non-admin user sees a clear error rather than a broken UI |
| 4 | `logoUrl` for `devops:designInfoProvider` referencing the remote backend may not work cross-origin | If logo doesn't render, copy `figma-logo.svg` into `admin/dist/` and reference it relatively |
| 5 | `iss` claim of the FIT verified to be `forge/invocation-token` (verbal confirmation) | Verified during code review; double-check at first inbound request |

---

## 10. Rollback plans

| Stage | Rollback |
|---|---|
| Section 3 (Stage 1 migration) | Drop the `cloud_id` columns + `jira_app_token` table; old code resumes working. Schema is fully forward-compatible until Stage 2 runs. |
| Section 4 (backfill) | Run `UPDATE <table> SET cloud_id = NULL` for each table. |
| Section 5 (new code deploy) | Roll back the container image to the pre-migration version. Old code reads `connect_installation_id`, which still exists at this point. |
| Section 6 (Stage 2 migration) | **Restore from the backup taken in Section 0.4.** This is the point of no return. |

---

## 11. Smoke test on a non-production tenant first

🚫 Do not run this in production until you have rehearsed the entire
sequence end-to-end on a test tenant. See the separate "Test deploy
plan" we'll draft next for the dry-run.
