# AGENTS.md — Honey Case Adventure

## Mission

Build a secure, mobile-first, bilingual legal-intake PWA for JACKLAW in which an adult client completes a small daily screening mission with Honey, a friendly dog who acts as an investigation partner. The experience should feel motivating and warm without trivializing the client’s legal problem.

## Non-negotiable product invariants

1. A client must never be presented with more than 10 distinct substantive questions in one local calendar day.
2. The limit must be enforced server-side and remain correct under retries, multiple tabs, and concurrent requests.
3. Honey progression must never depend on predicted case strength, damages, legal merit, or expected recovery.
4. There is no streak loss, pet injury, starvation, sadness, death, countdown pressure, random prize, or guilt mechanic.
5. Client-facing copy must never state or imply that the client has a case, will win, is owed money, or has a specific case value.
6. Spanish is the default client language; English is always available.
7. Sensitive client data must never be written to logs, analytics payloads, push text, or SMS content.
8. Authenticated pages, API responses, answers, and evidence must never be cached by the service worker.
9. Staff access must be authorized on the server for every request. UI hiding is not authorization.
10. Evidence is unavailable to staff until its malware-scan status is CLEAN, except to an explicitly authorized security administrator.
11. Question definitions are immutable once published. Edits create a new version.
12. Production must not serve DRAFT legal content unless an explicit, audited emergency feature flag is enabled.

## Engineering approach

- Prefer a modular monolith with explicit package boundaries over premature microservices.
- Keep domain logic framework-independent and testable without a browser.
- Use a transactional outbox for notifications and background work.
- Use idempotency keys for externally triggered writes and worker deliveries.
- Use database transactions and locking for daily-question budget allocation.
- Use immutable event or revision records for answers, progression grants, consents, and audit events.
- Use a small, validated JSON rule DSL. Never execute arbitrary rule code or use `eval`.
- Make security-sensitive defaults fail closed.
- Do not add a dependency without checking maintenance status, license, bundle impact, and whether the platform already provides the feature.
- Avoid clever abstractions until there are at least two real use cases.

## Expected repository shape when starting from an empty repo

```text
apps/
  web/                 # Next.js PWA and server/BFF
  worker/              # Outbox, notification, and evidence-scan orchestration
packages/
  domain/              # Pure TypeScript domain rules and services
  db/                  # PostgreSQL schema, migrations, repositories
  ui/                  # Accessible design system
  i18n/                # Typed ES/EN catalogs and helpers
  config/              # Environment validation and shared config
  testing/             # Factories, fixtures, test helpers
docs/
  adr/
  runbooks/
```

The agent may change this shape only after documenting the reason in an ADR.

## Baseline stack

When the repository has no reasonable existing stack, use:

- TypeScript in strict mode
- Next.js App Router for the web/BFF layer
- PostgreSQL
- Prisma or another mature typed database layer selected in ADR-0002
- pnpm workspaces
- Zod at all trust boundaries
- a maintained authentication/session library rather than custom cryptography
- Playwright for end-to-end tests
- an established unit-test runner
- Docker Compose for local infrastructure
- S3-compatible object storage with MinIO locally
- a transactional outbox worker backed by PostgreSQL

Pin versions in the lockfile. Do not use `latest` tags in production Docker images.

## Authentication policy

- Client identity: passwordless OTP through a provider interface. Development provider may print a code to the local console, but must be disabled in production.
- Staff identity: OIDC/SSO provider interface with MFA expected in production. Seeded local credentials are development-only.
- OTPs must be random, single-use, short-lived, hashed at rest, rate limited by account and IP, and protected against account enumeration.
- Sessions must use secure, HttpOnly cookies; `Secure` is mandatory in production.
- Rotate session identifiers after authentication and privilege changes.

## PII and logging

Never log:

- names
- phone numbers
- email addresses
- employer names
- answers or free text
- document names or contents
- invitation or verification tokens

Logs may contain opaque IDs, request IDs, event names, durations, status codes, and redacted error classes.

## Database and migrations

- Migrations are forward-only after merge.
- Every tenant-owned table must include `organization_id` unless an ADR documents why not.
- All queries for client or matter data must scope by organization and authorized actor.
- Add indexes based on actual query paths.
- Add uniqueness constraints for idempotency, daily budgets, answer revisions, reward grants, and outbox events.
- Use UTC timestamps in storage and IANA time zones for local-date calculations.

## Question engine

- Definitions are data, not JSX conditionals.
- Persist the exact question version shown to a client.
- The next slot may be selected after the current answer to support branching, but once a slot is allocated it never changes.
- Every substantive question opened by a client creates a unique daily interaction record. Reopening the same slot that day does not consume another unit.
- Before opening a new slot, acquire a transaction-scoped lock for the client and local date, verify remaining budget, create the interaction record, then commit.
- Administrative screens, consent, upload metadata, and language selection do not consume the substantive-question budget.

## UI and content

- Design for 360–430 px mobile widths first.
- Honey is a prominent guide, not a tiny decoration.
- Use adult, respectful copy. Avoid baby talk.
- Touch targets must be at least 44×44 CSS px.
- Every state must work with keyboard, screen reader, visible focus, and reduced motion.
- Use typed message catalogs. Do not scatter Spanish and English strings through components.
- Include saving, saved, retrying, offline, and error states for answers.
- Do not store answers or free text in localStorage. Keep unsaved data only in transient UI state and retry while the page is open.

## Testing expectations

At minimum, every relevant change must include tests for:

- authorization and cross-client isolation
- daily cap under concurrency
- idempotent answer save
- mission resume
- deterministic branching
- immutable question versions
- review-flag rules
- progression idempotency
- notification outbox retry behavior
- evidence quarantine and clean-only access
- ES/EN rendering
- accessibility smoke checks

Do not mark a task complete because code compiles. Run the relevant tests and report exact commands and outcomes.

## Completion protocol

Before declaring a phase done:

1. inspect the diff;
2. run formatting, lint, typecheck, unit tests, integration tests, and build as applicable;
3. run targeted end-to-end tests;
4. verify no PII appears in logs or fixtures;
5. update docs and ADRs;
6. list known limitations honestly;
7. leave the repository in a runnable state.
