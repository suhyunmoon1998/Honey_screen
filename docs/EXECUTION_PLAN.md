# Execution Plan

## Overview

This plan assumes the current repository is a greenfield documentation pack and sequences implementation into vertical milestones. Each milestone must leave the repository runnable from a clean checkout and must not overstate external integrations.

## Milestone 0: Foundation and Repo Bootstrap

### Outcome

A clean workspace boots a minimal Next.js app and worker, connects to local PostgreSQL and MinIO via Docker Compose, and supports deterministic validation commands.

### Files and packages affected

- root: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.editorconfig`, `.gitignore`, `.npmrc`
- root: `docker-compose.yml`, `.env.example`, `README.md`
- `apps/web/*`
- `apps/worker/*`
- `packages/config/*`
- `packages/db/*`
- `packages/domain/*`
- `packages/i18n/*`
- `packages/testing/*`
- `packages/ui/*`
- `.github/workflows/ci.yml`

### Schema changes

- Initial baseline schema for organizations, users, memberships, clients, invitations, sessions, consents, matters, audit events, and outbox.

### Acceptance tests

- deterministic `pnpm verify` scaffold exists
- Spanish default shell renders
- unauthenticated routes deny sensitive pages
- local infra boots with PostgreSQL and MinIO

### Commands to validate

```bash
pnpm install
docker compose up -d
pnpm prisma:migrate:dev
pnpm seed
pnpm dev
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm build
pnpm verify
```

### Rollback point

- Initial workspace bootstrap commit.

## Milestone 1: Secure Vertical Slice

### Outcome

A Spanish-default client can accept a fictional invitation, register with phone-first development OTP, complete onboarding, run a three-question mission with stable version snapshots, refresh/resume safely, receive a neutral Honey participation reward, and generate staff in-app notifications visible to an authorized development staff user.

### Files and packages affected

- `apps/web/app/(client)/*`
- `apps/web/app/(staff)/*`
- `apps/web/app/api/*`
- `apps/web/auth/*`
- `packages/domain/identity/*`
- `packages/domain/mission/*`
- `packages/db/repositories/*`
- `packages/i18n/catalogs/*`
- `packages/ui/components/*`
- `packages/testing/factories/*`

### Schema changes

- invitations
- verification challenges
- staff allowlist and role assignment support
- client identities
- consent records
- missions
- mission slots
- answer revisions
- answer current projection
- progress events
- reward grants
- in-app notification records
- retention foundation fields required for Task 01

### Acceptance tests

- acceptance section A from [docs/ACCEPTANCE_TESTS.md](/Users/davidmun/Downloads/honey-codex-senior-engineering-pack/docs/ACCEPTANCE_TESTS.md)
- invitation expiry and replay
- OTP throttle and single-use behavior
- approved role permission matrix
- authorization boundaries for client/staff/admin/anonymous
- mission resume after refresh and logout
- outbox-backed staff in-app notifications

### Commands to validate

```bash
pnpm lint
pnpm typecheck
pnpm test:unit -- mission identity i18n
pnpm test:integration -- auth invitation answers
pnpm test:e2e -- --project=mobile vertical-slice
pnpm build
pnpm verify
```

### Rollback point

- Last passing commit with the vertical slice and dev-only auth adapters.

## Milestone 2: Question Engine and Daily Cap

### Outcome

The mission engine supports deterministic 3/5/10 missions, branching, pacing, extension, and concurrency-safe daily-cap enforcement.

### Task 02 repository status

Implemented in the current repository:

- immutable `QuestionDefinition` and `QuestionVersion` structures
- deterministic selector with clarification and branch handling
- audited time-zone change support for local-date calculations
- PostgreSQL-backed daily-cap reservation during mission creation
- minimal staff/admin content workflow
- fictional bilingual seed set above 60 approved questions

### Files and packages affected

- `packages/domain/questions/*`
- `packages/domain/rules/*`
- `packages/domain/mission/*`
- `packages/db/repositories/mission*`
- `packages/db/sql/*`
- `apps/web/app/api/missions/*`
- `apps/web/app/api/answers/*`
- `packages/testing/concurrency/*`

### Schema changes

- question definitions
- question versions
- question categories
- daily question interactions
- review flags
- content publication metadata

### Acceptance tests

- acceptance sections B, C, D, and E where relevant
- concurrency remaining-budget-of-one race
- multiple tabs and retry behavior
- DST and time-zone edge cases
- question-version immutability after publication

### Commands to validate

```bash
pnpm prisma:migrate:dev
pnpm test:unit -- rules mission progression
pnpm test:integration -- daily-cap branching review-flags
pnpm test:e2e -- --project=mobile daily-cap branching
pnpm build
pnpm verify
```

### Rollback point

- Last passing commit before content-publication and mission-engine changes are expanded further.

### Remaining human decisions after Task 02

- whether mission-creation observability should remain audit-only or add a
  separate structured operational event table
- whether admin draft creation should later support editing branch and review
  rules in the UI instead of cloning them from the approved source version
- whether the staff content area needs explicit compare diffs beyond side-by-side
  approved and draft text for MVP

## Milestone 3: Honey Experience, PWA, and Notifications

### Outcome

The app becomes installable on supported browsers, records truthful install-related events, adds deterministic Honey progression UX, and introduces outbox-backed notification infrastructure with development adapters.

### Files and packages affected

- `apps/web/app/manifest.ts`
- `apps/web/public/*`
- `apps/web/service-worker/*`
- `apps/web/app/(client)/honey/*`
- `apps/web/app/api/notifications/*`
- `apps/worker/src/notifications/*`
- `packages/domain/progression/*`
- `packages/domain/notifications/*`
- `packages/ui/motion/*`

### Schema changes

- device installations
- push subscriptions
- notification preferences
- notification deliveries
- additional progress and reward definitions

### Acceptance tests

- acceptance sections F and G
- reduced-motion accessibility checks
- cache-storage regression for authenticated content
- notification dedupe, retry, and revocation

### Commands to validate

```bash
pnpm test:unit -- notifications progression
pnpm test:integration -- outbox push-subscriptions
pnpm test:e2e -- --project=mobile pwa notifications
pnpm build
pnpm verify
```

### Rollback point

- Last passing commit before service worker or notification adapters are introduced.

## Milestone 4: Evidence Pipeline and Staff Workflow

### Outcome

Clients can upload evidence to quarantine, the worker scans and promotes clean evidence, and staff can review client records and clean files without crossing authorization boundaries.

### Files and packages affected

- `apps/web/app/api/evidence/*`
- `apps/web/app/(staff)/clients/*`
- `apps/worker/src/evidence/*`
- `packages/db/repositories/evidence*`
- `packages/domain/evidence/*`
- `packages/domain/staff/*`
- `docs/runbooks/evidence-malware.md`

### Schema changes

- evidence documents
- evidence scan events
- staff notes
- contact requests
- assignment metadata
- export audit events

### Acceptance tests

- acceptance sections H and I
- safe fixture upload through clean-only staff view
- URL expiry behavior
- notes invisible to clients

### Commands to validate

```bash
pnpm prisma:migrate:dev
pnpm test:unit -- evidence authorization
pnpm test:integration -- evidence staff-dashboard signed-urls
pnpm test:e2e -- --project=mobile evidence-upload
pnpm test:e2e staff-review
pnpm build
pnpm verify
```

### Rollback point

- Last passing commit before evidence download and staff export are enabled.

## Milestone 5: Hardening, CI, and Release Candidate

### Outcome

The repository gains security headers, rate limits, runbooks, CI gates, readiness matrices, and release validation without overstating untested production integrations.

### Files and packages affected

- `.github/workflows/*`
- `apps/web/*` security headers and health endpoints
- `apps/worker/*` metrics and readiness
- `docs/runbooks/*`
- `docs/SECURITY.md`
- `README.md`
- deployment and Docker assets

### Schema changes

- optional metrics/audit support tables only if needed
- no breaking content-schema rewrites

### Acceptance tests

- acceptance sections J and K
- security regression suite
- privacy/log redaction checks
- backup/restore rehearsal docs verified

### Commands to validate

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm test:security
pnpm build
pnpm verify
docker compose up -d
```

### Rollback point

- Release-candidate candidate commit with a passing full verification gate.

## Cross-milestone rules

- Every milestone must leave the app runnable from a clean checkout.
- Every schema change must be forward-only after merge.
- Every new user-facing string must be added through typed ES/EN catalogs.
- Every security-sensitive path must ship with negative authorization tests.
- Every external adapter must be labeled one of:
  - implemented locally
  - adapter implemented, credentials required
  - production test passed
  - blocked

## Approved bindings carried into implementation

- Google Workspace-compatible production OIDC plus database-backed staff allowlist
- phone-first OTP abstraction with development provider only in Task 01
- provider-neutral malware scanner with ClamAV intended locally
- configurable retention model with approved default classes
- staff in-app notifications first, email/web-push abstractions later, SMS reminders disabled by feature flag
