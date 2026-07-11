# Honey Case Adventure

Task 01 implements a production-shaped vertical slice for Honey Case Adventure:

- Spanish-default invitation flow
- development-only phone OTP
- minimal onboarding
- mobile-first client dashboard with Honey
- 3-question mission snapshot
- server-side answer persistence
- mission resume
- neutral Honey reward
- transactional outbox plus staff in-app notifications
- development-only staff login with role enforcement
- Task 02 question engine, daily-cap enforcement, and content versioning closeout

## Local setup

1. Install dependencies:

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
```

2. Choose a local PostgreSQL path:

Docker Compose path documented for local infrastructure:

```bash
docker compose up -d
```

This Docker path is documented and statically reviewed in this repository, but it has not yet been runtime-validated on this machine.

Homebrew PostgreSQL path used during implementation validation:

```bash
brew install postgresql@16
brew services start postgresql@16
createdb honey_case_adventure
```

3. Create local env:

```bash
cp .env.example .env
```

If using Homebrew PostgreSQL with your local macOS user, set:

```bash
DATABASE_URL=postgresql://YOUR_OS_USER@localhost:5432/honey_case_adventure?schema=public
```

4. Run migrations and seed:

```bash
pnpm db:reset
```

Demo question content is guarded. Local fictional questions, demo staff users,
and the demo invitation require:

```bash
ALLOW_DEMO_CONTENT=true
```

This setting is allowed only in development or test and must fail closed in
production.

5. Start the app and worker:

```bash
pnpm dev
```

## Demo credentials

Staff:

- `staff.fictional@jacklaw.example`
- `FictionalPass123!`

Admin:

- `admin.fictional@jacklaw.example`
- `FictionalPass123!`

Client invitation:

- `/invite/honey-demo-invite`
- phone: `(555) 555-0101`
- development OTP: `246810`

## Validation

Commands used for validation during implementation:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm db:reset
pnpm db:verify-upgrade
pnpm test
pnpm build
pnpm test:e2e
```

## Upgrade verification

Use the closeout verifier to prove forward migration from a populated Task 01
database:

```bash
pnpm db:verify-upgrade
```

The command creates an isolated temporary PostgreSQL database, applies only the
Task 01 migration, inserts representative Task 01-era rows, applies the
remaining Task 02 migrations through the production migration path, verifies the
upgraded data, and drops the temporary database even on failure.

## Deferred production integrations

- Google Workspace OIDC for staff authentication
- real SMS OTP provider
- email provider adapter
- web push provider adapter
- malware scanner runtime
- object storage evidence pipeline
- PWA service worker and install semantics beyond the conservative plan

## Notes

- The browser flow uses the real invitation, OTP verification, and cookie-based session handoff on `http://localhost:3000`.
- Console or stub behaviors must never be represented as real external delivery.
