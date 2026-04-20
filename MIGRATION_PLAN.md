# Connect → Forge Migration Plan

This document captures the plan for migrating the Figma for Jira app from
Atlassian Connect to Atlassian Forge, with the backend running as a Forge
Remote (the Express server stays hosted on our own infrastructure).

## Guiding Decisions

- **Backend hosting:** stays as a self-hosted Express service running as a
  Forge Remote.
- **Auth:** all inbound auth is via Forge Invocation Tokens (FITs). All
  Connect JWT auth (asymmetric, context, server-to-server) is replaced.
- **Modules:** all `connectModules` are replaced with native Forge modules.
- **Lifecycle:** the `installed` lifecycle is **dropped entirely** —
  `installedUseCase` is **deleted**. Only `preUninstall` is kept (to clean
  up Figma webhooks).
- **Data model:** `ConnectInstallation` (and its `clientKey` /
  `sharedSecret`) is removed entirely. `cloudId` (string) replaces
  `connectInstallationId` everywhere as the per-installation identifier.
  The Jira `baseUrl` is no longer stored — it is derived deterministically
  from `cloudId` (`https://api.atlassian.com/ex/jira/{cloudId}`).
- **Outbound Jira auth:** `jiraClient` JWT signing is replaced with Forge
  app token auth (Phase 5 — depends on Phase 3 being done).
- **Admin UI:** moves from a Connect iframe to a Forge Custom UI module
  (`jira:adminPage`). The React app at `admin/` is largely reused; only
  auth + HTTP client change (`@forge/bridge`).
- **OAuth state:** the Figma OAuth2 `state` JWT encodes `cloudId` instead
  of `connectClientKey` (Phase 7).
- **Migration strategy:** the database migration is data-preserving and
  zero-downtime. Two migrations + a backfill script (see below).

## Target Architecture

```
            ┌─────────┐                   ┌────────────────────┐
   User  →  │  Forge  │  ── FIT-signed →  │  Express backend   │
            │ Platform│      HTTPS        │  (Forge Remote)    │
            └─────────┘                   │                    │
                                          │  PostgreSQL        │
                                          │  Figma API         │
                                          └────────────────────┘
```

- Forge Platform handles inbound user requests, signs them with a Forge
  Invocation Token (FIT), and forwards to the Express backend.
- Express backend verifies the FIT, extracts `cloudId` and `accountId`
  from the token claims, then runs business logic.
- Outbound calls to Jira go through Forge OAuth 2.0 app tokens.
- Outbound calls to Figma use per-user Figma OAuth 2.0 tokens (unchanged).

## Phased Plan

### ✅ Phase 1 — Manifest migration (done)

`manifest.yml` rewritten to use native Forge modules:

- `devops:designInfoProvider` — replaces `jira:jiraDesignInfoProvider`
- `jira:adminPage` (with `useAsConfig: true`) — replaces
  `configurePage` / `adminPages` / `webSections`
- `preUninstall` — replaces `jira:lifecycle.uninstalled`
- (`installed` lifecycle is **dropped** — no replacement)
- `function: pre-uninstall-handler` — Forge function that handles the
  preUninstall trigger

`admin/vite.config.ts` updated to use `base: './'` (required for Forge
Custom UI).

Connect-specific scopes (`read/write/delete:connect-jira`) replaced with
Forge scopes (`read/write/delete:jira-work`).

### ✅ Phase 3 — Backend FIT verification (done)

Done **before** Phase 2+4 because all subsequent route changes depend on
the FIT middleware being in place.

- `src/web/middleware/forge/forge-invocation-token-verifier.ts` —
  verifies FITs via Atlassian JWKS at
  `https://forge.cdn.prod.atlassian-dev.net/.well-known/jwks.json`
- `src/web/middleware/forge/forge-invocation-token-middleware.ts` —
  Express middleware that wraps the verifier, populates `res.locals` with
  `cloudId`, `accountId`, `isAdminUser`
- All four routers updated: `lifecycle-events`, `auth`, `entities-v2`,
  `admin` — they now use `forgeInvocationTokenMiddleware` in place of the
  three Connect JWT middlewares
- `FORGE_APP_ID` added to config (read by middleware as the expected
  `aud` claim)
- `JIRA_CONNECT_KEY_SERVER_URL` removed
- `jose@4` added as dependency
- Unit tests for verifier (6) and middleware (4): all 10 passing

The old Connect JWT middleware files are **still in place** but unused —
they will be deleted in Phase 8 cleanup.

### 🚧 Phase 2+4 — Lifecycle function + remove ConnectInstallation (in progress)

These are coupled and must land together.

#### Foundational work (committed)

- ✅ `manifest.yml` — `installed` trigger removed, `preUninstall` only,
  function renamed to `pre-uninstall-handler`
- ✅ `prisma/schema.prisma` — fully rewritten:
  - `ConnectInstallation` model removed
  - All 4 related models have `cloudId` (String) instead of
    `connectInstallationId` (BigInt FK)
  - All composite uniques and indexes updated
- ✅ `prisma/migrations/20260420000001_add_cloud_id/migration.sql` —
  additive: adds nullable `cloud_id` columns + indexes. SAFE to deploy
  to production immediately.
- ✅ `prisma/migrations/20260420000002_drop_connect_installation/migration.sql`
  — destructive: makes `cloud_id` NOT NULL, drops legacy unique
  constraints, FKs, columns, and the `jira_connect_installation` table.
  ⚠️ DO NOT deploy until backfill is verified and new app code is live.
- ✅ `scripts/backfill-cloud-id.ts` — idempotent script that reads each
  `jira_connect_installation`, calls `${baseUrl}/_edge/tenant_info` to
  resolve real `cloudId`, then propagates it to all related tables.

#### Production migration runbook

1. Deploy migration `20260420000001_add_cloud_id` (additive, safe).
2. Run backfill: `DATABASE_URL=<prod> npx ts-node scripts/backfill-cloud-id.ts`
3. Verify: `SELECT COUNT(*) FROM <table> WHERE cloud_id IS NULL` returns
   0 for all 4 tables.
4. Deploy the new app code (post-Phase-4) that reads/writes `cloud_id`
   exclusively. Validate in production for some bake-in period.
5. Deploy migration `20260420000002_drop_connect_installation`.

#### Remaining Phase 2+4 work

The application code refactor itself is still in progress:

- [ ] Delete `src/usecases/installed-use-case.ts` and its test
- [ ] Delete `src/domain/entities/connect-installation.ts`
- [ ] Delete `src/infrastructure/repositories/connect-installation-repository.ts`
- [ ] Update `src/domain/entities/connect-user-info.ts` (rename
      `connectInstallationId` → `cloudId`, possibly rename the type to
      `ForgeUserInfo`)
- [ ] Update `src/domain/entities/index.ts` exports
- [ ] Update 4 entity classes to use `cloudId`: - `figma-team.ts` - `figma-oauth2-user-credentials.ts` - `associated-figma-design.ts` - `figma-file-webhook.ts`
- [ ] Update 4 repository files to use `cloudId`: - `figma-team-repository.ts` - `figma-oauth2-user-credentials-repository.ts` - `associated-figma-design-repository.ts` - `figma-file-webhook-repository.ts` - Update `index.ts` exports
- [ ] Update 11 use cases to take `cloudId: string` instead of
      `connectInstallation: ConnectInstallation`: - `check-user-figma-auth-use-case` - `connect-figma-team-use-case` - `disconnect-figma-team-use-case` - `get-current-figma-user-use-case` - `get-design-by-url-use-case` - `handle-figma-authorization-response-use-case` - `handle-figma-file-update-event-use-case` - `list-figma-teams-use-case` - `on-design-associated-with-issue-use-case` - `on-design-disassociated-from-issue-use-case` - `uninstalled-use-case`
- [ ] Update infrastructure services to use `cloudId`: - `jiraService` (and sub-services: `jiraDesignService`,
      `jiraIssueService`, `jiraUserService`, `jiraAppConfigurationService`) - `figmaService` - `figmaAuthService` (incl. OAuth state JWT change — Phase 7) - `figmaBackwardIntegrationServiceV2`
- [ ] Update `jiraClient` (`src/infrastructure/jira/jira-client/jira-client.ts`): - Derive `baseUrl` from `cloudId`
      (`https://api.atlassian.com/ex/jira/{cloudId}`) - Stub auth header (real auth is Phase 5)
- [ ] Update routes to read `cloudId` from `res.locals`: - `lifecycle-events-router.ts` (drop `/installed` route entirely;
      leave `/uninstalled` for the Forge function to call) - `auth/auth-router.ts` - `entities-v2/entities-router.ts` - `admin/admin-router.ts` (and its sub-routers `auth`, `teams`) - `figma/figma-router.ts` (webhook handler looks up by `cloudId`)
- [ ] Update request schemas: - Lifecycle event schemas: replace Connect payload with simple
      `{ cloudId }` payload
- [ ] Create `src/forge/pre-uninstall.ts`: - Forge function that does an HTTP `POST` to
      `${REMOTE_URL}/lifecycleEvents/uninstalled` with `{ cloudId }`
      in the body
- [ ] Update job: `src/jobs/handle-figma-file-update-event.ts`
- [ ] Update tests (~30 files)
- [ ] Verify TypeScript compiles and unit tests pass

### Phase 5 — Outbound Jira API auth migration

Replace the placeholder auth in `jiraClient` with Forge OAuth 2.0 app
token auth.

- Update `src/infrastructure/jira/jira-client/jira-client.ts` to use
  Bearer token auth obtained from Forge
- Delete `src/infrastructure/jira/jira-client/jwt-utils.ts`

### Phase 6 — Admin UI Custom UI migration

Migrate the React admin frontend to Forge Custom UI using
`@forge/bridge`.

- Install `@forge/bridge` in `admin/`
- Replace `AP.context.getToken()` (Connect iframe) with
  `view.getContext()` (Forge bridge)
- Replace direct axios calls with `requestRemote` from `@forge/bridge`
- Update `admin/src/api/axiosInstance.ts` and all API modules
- Vite config already updated in Phase 1 (`base: './'`)

### Phase 7 — Figma OAuth2 callback adaptation

The Figma OAuth2 redirect callback's `state` JWT currently encodes
`connectClientKey`. Replace with `cloudId`. The callback route stays on
the Express backend (Figma redirects directly to our server, not through
Forge).

### Phase 8 — Cleanup & hardening

- Delete `src/atlassian-connect.ts`
- Delete `src/infrastructure/jira/inbound-auth/` directory
- Delete the three old Connect JWT middleware files in
  `src/web/middleware/jira/`
- Remove `/atlassian-connect.json` route
- Remove unused config (`APP_KEY`, etc.)
- Update integration tests to use FIT mocks instead of Connect JWT mocks

## Reference: Key Files

| Concern                   | File                                                             |
| ------------------------- | ---------------------------------------------------------------- |
| Manifest                  | `manifest.yml`                                                   |
| FIT verifier              | `src/web/middleware/forge/forge-invocation-token-verifier.ts`    |
| FIT middleware            | `src/web/middleware/forge/forge-invocation-token-middleware.ts`  |
| FIT test mocks            | `src/web/testing/forge-invocation-token-mocks.ts`                |
| DB schema                 | `prisma/schema.prisma`                                           |
| Migration 1 (additive)    | `prisma/migrations/20260420000001_add_cloud_id/`                 |
| Migration 2 (destructive) | `prisma/migrations/20260420000002_drop_connect_installation/`    |
| Backfill script           | `scripts/backfill-cloud-id.ts`                                   |
| Forge JWKS URL            | `https://forge.cdn.prod.atlassian-dev.net/.well-known/jwks.json` |
