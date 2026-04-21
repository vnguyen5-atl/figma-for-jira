# Test Deployment Plan — Forge Migration Smoke Test

**Goal:** Stand up the migrated app on a personal test tenant, install
it, and walk through the **happy path** end-to-end. We're testing the
fresh-install path (no Connect data migration involved).

**Scope:** Just enough validation to confirm the migration "works"
before the app owner attempts a real production migration.

---

## What we're going to test

| Flow | Validates |
|---|---|
| App install on test site | Forge manifest valid; `jira:adminPage` registers |
| Admin Custom UI loads | `@forge/bridge` integration; remote backend reachable via `requestRemote` |
| Connect a Figma team | FIT auth on `/admin/teams/connect`; outbound Figma API call works |
| Link a Figma design to a Jira issue | `devops:designInfoProvider` end-to-end (most complex flow) |
| Update the design in Figma | Webhook → persisted system token → outbound Jira call |
| Uninstall the app | `preUninstall` Forge function fires; data cleanup happens |

---

## Prerequisites checklist

Before starting, confirm you have:

- [ ] A test Atlassian Cloud site (e.g. `your-name-test.atlassian.net`)
      where you have site-admin permissions
- [ ] Docker Desktop running on your laptop
- [ ] Node 22.x installed (`nvm use` if needed — `.nvmrc` is present)
- [ ] `forge` CLI installed: `npm install -g @forge/cli`
- [ ] Logged in to Forge: `forge login` (use your atlassian.com account)
- [ ] Your public tunnel URL ready (per the README, this is your
      `connectie-vnguyen5.public.atlastunnel.com` setup)
- [ ] A Figma account with API access + a Figma app registered (existing
      from your dev workflow — should be in your `.env` already)

---

## Step 1 — Local Postgres via Docker

The `docker-compose.yml` at the repo root spins up Postgres for the
remote backend. The npm script `start:sandbox` wraps this.

```bash
# From the repo root
npm run start:sandbox
```

This runs `./scripts/start-sandbox.sh docker-compose.yml`, which:

- Starts the `figma-for-jira-db` Postgres container in the background
- Runs `prisma migrate deploy` once the DB is healthy

To verify:

```bash
docker ps | grep figma-for-jira-db
# Expect: a running container exposing whatever PG_FIGMA_FOR_JIRA_DB_PORT
# is set to in your .env (default 5432)

env $(cat .env | grep -v '^#' | xargs) npx prisma migrate status
# Expect: "Database schema is up to date!"
```

Tables that should exist:

```sql
\dt
# Expect:
#   jira_associated_figma_design
#   jira_app_token             (new in this migration — Phase 5)
#   jira_figma_oauth2_user_credentials
#   jira_figma_team
#   jira_figma_file_webhook
# Note: jira_connect_installation should NOT exist (was dropped in
# Phase 4 of the migration)
```

To stop later: `npm run stop:sandbox`.

---

## Step 2 — Register the Forge app

```bash
# From the repo root
forge register
```

Prompts:
- **Name** — pick something obvious like `figma-for-jira-test-vnguyen5`
- **Workspace / org** — pick your dev org

`forge register` writes the new app ID into `manifest.yml` `app.id`.
Capture it — you also need it as an env var.

Then update your local `.env`:

```bash
# Open .env and set:
FORGE_APP_ID=ari:cloud:ecosystem::app/<the-uuid-forge-register-printed>
```

Verify the manifest got updated:

```bash
grep "id:" manifest.yml
# Expect: id: ari:cloud:ecosystem::app/<uuid>
```

---

## Step 3 — Confirm `manifest.yml` points at your tunnel

Open `manifest.yml` and verify:

```yaml
remotes:
  - key: connect
    baseUrl: https://connectie-vnguyen5.public.atlastunnel.com
    # ...

modules:
  devops:designInfoProvider:
    - logoUrl: https://connectie-vnguyen5.public.atlastunnel.com/static/figma-logo.svg
```

Both should be your real public-tunnel URL. Adjust if they aren't
already.

---

## Step 4 — Build the admin Custom UI

The Forge CLI uploads whatever's in `admin/dist`, so it must be built
first.

```bash
cd admin
npm install   # only the first time, picks up @forge/bridge
npm run build
ls dist/
# Expect: index.html + assets/
cd ..
```

---

## Step 5 — Start the remote backend + tunnel

In one terminal:

```bash
npm start
```

In a second terminal:

```bash
npm run start:tunnel
```

Verify the tunnel is up by curling the static logo (no auth needed):

```bash
curl -I https://connectie-vnguyen5.public.atlastunnel.com/static/figma-logo.svg
# Expect: HTTP/2 200
```

Note: previously you'd hit `/atlassian-connect.json` — that endpoint no
longer exists in the Forge migration. The static logo URL is the
simplest reachability check.

---

## Step 6 — Deploy the Forge app

```bash
forge deploy
```

This uploads:
- The manifest (modules, scopes, remote URL, scheduledTrigger,
  preUninstall function)
- The Forge function bundles (`pre-uninstall.handler`,
  `refresh-app-tokens.handler`)
- The admin Custom UI from `admin/dist/`

If `forge deploy` reports manifest validation errors (e.g. on the
undocumented `devops:designInfoProvider` schema, or the
`jira:adminPage` minimal config), fix them and redeploy. This is one of
the open questions flagged in MIGRATION_PLAN.md — we expect to debug
some of these here.

---

## Step 7 — Install the app on your test site

```bash
forge install --site https://your-name-test.atlassian.net --product jira
```

Forge will:
- Show you the scopes the app is requesting
  (`read:jira-work`, `write:app-data:jira`, `read:app-system-token`)
- Prompt for confirmation
- Install into your test site

**Watch your remote backend logs in the `npm start` terminal during
this step.** You should see no inbound traffic during `install` itself
because we removed the `installed` lifecycle handler — the install is
a pure metadata operation on the Forge side. The remote should only
start receiving traffic when you interact with the app.

---

## Step 8 — Smoke test: admin UI

1. Open your test site → ⚙ → **Apps** → **Manage your apps**
2. Find "Figma for Jira (test)" (or whatever you named it) → click
   **Configure** (or **Get started**)
3. **Expected:** the admin Custom UI iframe loads and shows the Figma
   teams page
4. **Watch the remote logs** — you should see `GET /admin/auth/me`
   succeed (FIT-authenticated), followed by `GET /admin/teams`

**If it fails:** the most likely culprits are:
- FIT verification rejecting the token (check the verifier's `iss` /
  `aud` claims against what Forge actually sends — see open question
  #5 in MIGRATION_PLAN.md)
- `requestRemote` not reaching the tunnel (check tunnel is up)
- CORS / iframe sandbox issue with the Custom UI

---

## Step 9 — Smoke test: connect a Figma team

1. In the admin UI, click **Connect a Figma team**
2. You'll be redirected to Figma to authorize, then back
3. Pick a team from the dropdown and click **Connect**
4. **Expected:** the team appears as connected
5. **Watch the remote logs** — you should see:
   - `GET /admin/auth/me` (already authorized after redirect)
   - `POST /admin/teams/:teamId/connect`
   - Outbound calls: `POST https://api.figma.com/v2/webhooks` (creating
     the Figma webhook), and `PUT
     https://api.atlassian.com/ex/jira/<cloudId>/rest/forge/1/app/properties/is-configured`
     (using the FIT system token)

**If `/admin/teams/connect` returns 401:** the FIT middleware is
rejecting because either `isAdminUser=false` (you're not admin on the
test site) or the FIT issuer/audience check is wrong.

**If the outbound `PUT` returns 403:** the Forge OAuth scope for app
properties isn't right — check the manifest scope string and re-deploy.

---

## Step 10 — Smoke test: link a Figma design

1. Open any Jira issue on your test site
2. In the side panel, find the **Designs** section → **Add design**
3. Paste a Figma file URL (any file you have access to)
4. **Expected:** the design appears in the panel with title + thumbnail
5. **Watch the remote logs**:
   - `POST /entities/onEntityAssociated` (FIT-authenticated, called by
     Forge as part of the `devops:designInfoProvider` contract)
   - Outbound `POST
     https://api.atlassian.com/ex/jira/<cloudId>/rest/designs/1.0/bulk`

**If this fails with 403 on the outbound `bulk` call:** see open
question #2 — the Designs API may need an additional scope.

**If it fails on the inbound side with "module not found":** see open
question #1 — `devops:designInfoProvider` may have additional required
manifest fields.

---

## Step 11 — Smoke test: design auto-update via webhook

This is the hardest flow because it tests the **persisted-token path**
(no inbound FIT).

1. Open the Figma file in Figma
2. Make any change (add a frame, rename something)
3. Wait ~1 minute, then refresh the Jira issue
4. **Expected:** the design title or thumbnail in Jira reflects the
   change
5. **Watch the remote logs**:
   - Inbound `POST /figma/webhook` (Figma → remote, NO FIT, auth via
     Figma passcode)
   - The handler reads the persisted `jiraAppToken` from Postgres
   - Outbound `POST .../rest/designs/1.0/bulk` using the persisted
     token

**If the webhook handler fails with "no persisted Jira app token":**
the Forge `scheduledTrigger` (`refresh-app-tokens.handler`) hasn't
fired yet. It runs on the `hour` schedule, which means up to 60 min
of waiting for the first invocation. Workaround for testing: hit the
admin UI any other way (just opening it triggers
`forgeInvocationTokenMiddleware`, which persists a fresh token).

---

## Step 12 — Smoke test: uninstall

```bash
forge uninstall --site https://your-name-test.atlassian.net --product jira
```

**Expected:**
- The `preUninstall` Forge function fires
- It calls `POST <remote>/lifecycleEvents/uninstalled` with a FIT
- The remote `uninstalledUseCase` deletes:
  - The `jira_figma_team` row (which triggers Figma webhook deletion)
  - The `jira_associated_figma_design` rows
  - The `jira_figma_oauth2_user_credentials` rows
  - The `jira_figma_file_webhook` rows
  - The `jira_app_token` row
  - The `is-configured` Jira app property

**Watch the remote logs** for the `POST /lifecycleEvents/uninstalled`
call.

**Verify** the DB is clean for that cloud ID:

```sql
psql ${DATABASE_URL}
SELECT cloud_id FROM jira_figma_team;
SELECT cloud_id FROM jira_associated_figma_design;
SELECT cloud_id FROM jira_app_token;
-- All should return no rows for the uninstalled cloudId.
```

---

## Step 13 — Cleanup

```bash
# Stop the remote backend (Ctrl-C in npm start terminal)
# Stop the tunnel (Ctrl-C in tunnel terminal)
# Stop Postgres
npm run stop:sandbox
```

Forge dev environment cleanup (optional):

```bash
forge uninstall --site <your-site> --product jira  # if not already done
forge environments delete development              # nukes the whole dev env
```

---

## Troubleshooting cheat sheet

| Symptom | Likely cause | Where to look |
|---|---|---|
| Admin UI shows blank iframe | Custom UI bundle missing/broken | `cd admin && npm run build`, then `forge deploy` |
| Admin UI loads but every API call 401s | FIT verifier rejecting tokens | Check `iss`/`aud` claims; check `FORGE_APP_ID` env var matches manifest |
| `forge deploy` rejects manifest | Schema validation | Read the error and either fix the manifest or file Forge support if it's about `devops:designInfoProvider` |
| Outbound Jira call 403 | Wrong scope | Check `permissions.scopes` in manifest |
| Outbound Jira call 401 | `x-forge-oauth-system` header missing | Confirm `auth.appSystemToken.enabled: true` in manifest + `read:app-system-token` scope |
| Webhook flow fails with "no token" | Scheduled trigger hasn't fired yet | Open the admin UI to trigger token persistence, then retry the webhook |
| Design panel empty after linking | `devops:designInfoProvider` not registered | Check `forge install --upgrade` was needed |

---

## When you hit issues

Run the failing flow again with the remote backend logs visible. Copy
the relevant log lines (request URL, FIT claims if logged, outbound
URL + status code) and we'll work through them together.

---

## What this plan does NOT cover

- Migrating existing Connect customer data (covered in
  `PRODUCTION_MIGRATION_RUNBOOK.md` Section 4)
- Marketplace publication (separate process)
- Multi-tenant load testing
- The "sad path" — error handling, edge cases, retries
- Validating the integration tests (run `npx jest --config
  jest.config.integration.ts --runInBand` separately if you want)

We're just confirming the happy path works end-to-end.
