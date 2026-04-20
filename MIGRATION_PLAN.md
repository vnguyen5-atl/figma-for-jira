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
  from `cloudId` (`https://api.atlassian.com/ex/jira/{cloudId}`). For
  user-facing browse URLs (e.g., dev resource backlinks), the site URL is
  derived from the `self` field of Jira API responses.
- **Outbound Jira auth:** `jiraClient` JWT signing is replaced with Forge
  app token auth (Phase 5 — currently a `Bearer FORGE_APP_TOKEN_PLACEHOLDER`
  stub).
- **Admin UI:** moves from a Connect iframe to a Forge Custom UI module
  (`jira:adminPage`). The React app at `admin/` is largely reused; only
  auth + HTTP client change (`@forge/bridge`).
- **OAuth state:** the Figma OAuth2 `state` JWT encodes `cloudId` instead
  of `connectClientKey` (landed as part of Phase 2+4).
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
- Outbound calls to Jira go through Forge OAuth 2.0 app tokens (Phase 5).
- Outbound calls to Figma use per-user Figma OAuth 2.0 tokens (unchanged).

## Phased Plan

### ✅ Phase 1 — Manifest migration (done)

Commit: `4cd1521`

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

### ✅ Phase 2+4 — Lifecycle function + remove ConnectInstallation (done)

These were coupled and landed together.

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
4. Deploy the new app code (this commit) that reads/writes `cloud_id`
   exclusively. Validate in production for some bake-in period.
5. Deploy migration `20260420000002_drop_connect_installation`.

#### Application code refactor (committed)

- ✅ Deleted `src/usecases/installed-use-case.ts` and its test
- ✅ Deleted `src/domain/entities/connect-installation.ts`
- ✅ Deleted `src/infrastructure/repositories/connect-installation-repository.ts`
- ✅ Updated `src/domain/entities/connect-user-info.ts` (rename
  `connectInstallationId` → `cloudId`)
- ✅ Updated `src/domain/entities/index.ts` exports
- ✅ Updated 4 entity classes to use `cloudId`: - `figma-team.ts` - `figma-oauth2-user-credentials.ts` - `associated-figma-design.ts` - `figma-file-webhook.ts`
- ✅ Updated 4 repository files to use `cloudId`: - `figma-team-repository.ts` - `figma-oauth2-user-credentials-repository.ts` - `associated-figma-design-repository.ts` - `figma-file-webhook-repository.ts` - Updated `index.ts` exports
- ✅ Updated 11 use cases to take `cloudId: string`: - `check-user-figma-auth-use-case` - `connect-figma-team-use-case` - `disconnect-figma-team-use-case` - `get-current-figma-user-use-case` - `get-design-by-url-use-case` - `handle-figma-authorization-response-use-case` - `handle-figma-file-update-event-use-case` - `list-figma-teams-use-case` - `on-design-associated-with-issue-use-case` - `on-design-disassociated-from-issue-use-case` - `uninstalled-use-case` — now explicitly deletes from each table
  (no cascade root)
- ✅ Updated infrastructure services to use `cloudId`: - `jiraService` (and sub-services: `jiraDesignService`,
  `jiraIssueService`, `jiraUserService`, `jiraAppConfigurationService`) - `figmaService` — already uses `ConnectUserInfo`, which now has `cloudId` - `figmaAuthService` — incl. OAuth state JWT change (encodes `cloudId`
  in `iss` claim instead of `connectClientKey`) - `figmaBackwardIntegrationServiceV2` — derives Jira site URL from
  `issue.self` (since `baseUrl` is no longer stored)
- ✅ Updated `jiraClient`: - Derives `baseUrl` from `cloudId`
  (`https://api.atlassian.com/ex/jira/{cloudId}/`) - Auth header is a placeholder Bearer stub (Phase 5 replaces this) - App property URLs changed from
  `rest/atlassian-connect/1/addons/{addonKey}/properties/...` to
  `rest/forge/1/app/properties/...`
- ✅ Updated routes to read `cloudId` from `res.locals`: - `lifecycle-events-router.ts` — only `/uninstalled` route remains;
  request body simplified to `{ cloudId }` - `auth/auth-router.ts` - `entities-v2/entities-router.ts` - `admin/admin-router.ts`, `admin/auth/auth-router.ts`,
  `admin/teams/teams-router.ts`
- ✅ Updated request schemas: - Lifecycle event schemas: replaced Connect payload with simple
  `{ cloudId }` payload
- ✅ Created `src/forge/pre-uninstall.ts`: - Forge function that does an HTTP `POST` to
  `${REMOTE_URL}/lifecycleEvents/uninstalled` with `{ cloudId }`
  in the body. Uses `@forge/api` (provided by Forge runtime) so
  the FIT is included automatically.

#### Cleanup (also done)

- ✅ Deleted `src/atlassian-connect.ts` (Connect descriptor generator)
- ✅ Deleted `src/infrastructure/jira/inbound-auth/` directory entirely
- ✅ Deleted the three old Connect JWT middleware files in
  `src/web/middleware/jira/`
- ✅ Deleted `/atlassian-connect.json` route from the root router
- ✅ Removed `JIRA_CONNECT_KEY_SERVER_URL` from `.env.example`,
  `.env.test`, and `src/config/config.ts`
- ✅ Deleted `src/web/testing/jira-jwt-token-mocks.ts` and
  `src/web/testing/connect-api-mock.ts`

#### Verification

- ✅ `npx tsc --noEmit -p tsconfig.build.json` — production code
  compiles cleanly with no errors.
- ✅ `npm run test:unit` — **all 248 unit tests passing.**

#### Unit test refactor (done)

All 23 unit test files were updated to use `cloudId` instead of
`connectInstallation`. The work was done as a bulk `sed` replacement plus
targeted rewrites for the few tests that needed structural changes
(`uninstalled-use-case.test.ts` now mocks `prismaClient.$transaction` since
the use case deletes data via direct Prisma calls, and `jira-client.test.ts`
asserts the new Forge-style URL pattern + Bearer auth header).

Connect-only test mocks deleted:

- `src/web/routes/entities-v2/testing/`
- `src/web/routes/lifecycle-events/testing/`
- `src/web/testing/jira-jwt-token-mocks.ts`
- `src/web/testing/connect-api-mock.ts`

#### Integration tests (deferred to Phase 8)

- [ ] **Integration tests** — 6 files still reference Connect JWT helpers
      `connectInstallation` → `cloudId` refactor across all test files.
      Production code is done and TypeScript-clean, but the existing tests
      still reference deleted helpers (`generateConnectInstallation`,
      `connectInstallationRepository`) and the old parameter shape. The
      patterns to apply across all 23 files: - `generateConnectInstallation()` → drop entirely; use
      `generateCloudId()` and pass strings - `connectInstallation` parameter → `cloudId` string - `connectInstallation.id` → `cloudId` - `connectInstallationId:` field → `cloudId:` - Remove `connectInstallationRepository` mocks/imports - Integration tests: update auth header generation to use
      `generateForgeInvocationToken` from
      `src/web/testing/forge-invocation-token-mocks.ts` instead of
      Connect JWT mocks

      Affected test files:
      - `src/web/routes/entities-v2/integration.test.ts`
      - `src/web/routes/lifecycle-events/integration.test.ts`
      - `src/web/routes/auth/integration.test.ts`
      - `src/web/routes/admin/auth/integration.test.ts`
      - `src/web/routes/admin/teams/integration.test.ts`
      - `src/web/routes/figma/integration.test.ts`
      - `src/infrastructure/figma-backward-integration-service-v2.test.ts`
      - `src/infrastructure/repositories/figma-team-repository.integration.test.ts`
      - `src/infrastructure/repositories/associated-figma-design-repository.integration.test.ts`
      - `src/infrastructure/jira/jira-design-service.test.ts`
      - `src/infrastructure/jira/jira-app-configuration-service.test.ts`
      - `src/infrastructure/jira/jira-user-service.test.ts`
      - `src/infrastructure/jira/jira-issue-service.test.ts`
      - `src/infrastructure/jira/jira-client/jira-client.test.ts`
      - `src/infrastructure/figma/figma-service.test.ts`
      - `src/infrastructure/figma/figma-auth-service.test.ts`
      - `src/usecases/on-design-associated-with-issue-use-case.test.ts`
      - `src/usecases/get-design-by-url-use-case.test.ts`
      - `src/usecases/connect-figma-team-use-case.test.ts`
      - `src/usecases/handle-figma-file-update-event-use-case.test.ts`
      - `src/usecases/on-design-disassociated-from-issue-use-case.test.ts`
      - `src/usecases/disconnect-figma-team-use-case.test.ts`
      - `src/usecases/uninstalled-use-case.test.ts`

### Phase 5 — Outbound Jira API auth migration (next)

Replace the placeholder `Bearer FORGE_APP_TOKEN_PLACEHOLDER` in
`jiraClient.buildAuthorizationHeader` with a real Forge app access
token.

- Update `src/infrastructure/jira/jira-client/jira-client.ts` to obtain
  an OAuth 2.0 app access token from Forge for the given `cloudId`,
  using `@forge/api` or the Forge Remote OAuth flow
- Delete `src/infrastructure/jira/jira-client/jwt-utils.ts` (the legacy
  symmetric JWT signing utility — no longer used after Phase 4)
- Update `jiraClient` unit tests for the new auth header

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

✅ **Already landed as part of Phase 2+4.** The Figma OAuth2 redirect
callback's `state` JWT now encodes `cloudId` (in the `iss` claim) instead
of `connectClientKey`. The callback route stays on the Express backend
(Figma redirects directly to the server, not through Forge).

### Phase 8 — Final cleanup & hardening

- Update remaining tests (covered in the Phase 2+4 remaining work above)
- Remove unused config (`APP_KEY` if no longer needed)
- Remove unused dependencies (`atlassian-jwt` once Figma OAuth state
  signing is migrated, etc.)
- Update integration test setup (`scripts/setup-jest-integration-tests.ts`)
  to drop the `connectInstallation.deleteMany` (no such table exists
  after migration 2)
- Verify all unit + integration tests pass

## Reference: Key Files

| Concern                    | File                                                             |
| -------------------------- | ---------------------------------------------------------------- |
| Manifest                   | `manifest.yml`                                                   |
| FIT verifier               | `src/web/middleware/forge/forge-invocation-token-verifier.ts`    |
| FIT middleware             | `src/web/middleware/forge/forge-invocation-token-middleware.ts`  |
| FIT test mocks             | `src/web/testing/forge-invocation-token-mocks.ts`                |
| Forge preUninstall handler | `src/forge/pre-uninstall.ts`                                     |
| DB schema                  | `prisma/schema.prisma`                                           |
| Migration 1 (additive)     | `prisma/migrations/20260420000001_add_cloud_id/`                 |
| Migration 2 (destructive)  | `prisma/migrations/20260420000002_drop_connect_installation/`    |
| Backfill script            | `scripts/backfill-cloud-id.ts`                                   |
| Forge JWKS URL             | `https://forge.cdn.prod.atlassian-dev.net/.well-known/jwks.json` |

## Key Test Helpers (post-migration)

| Old (Connect)                               | New (Forge)                              |
| ------------------------------------------- | ---------------------------------------- |
| `generateConnectInstallation()`             | `generateCloudId()` (returns string)     |
| `generateConnectInstallationCreateParams()` | (deleted — no longer needed)             |
| `connectInstallationRepository` (mock)      | (deleted — no longer needed)             |
| `generateJiraServerSymmetricJwtToken` etc   | `generateForgeInvocationToken`           |
| `mockConnectGetKeyEndpoint`                 | (deleted — FIT verifier uses local JWKS) |
