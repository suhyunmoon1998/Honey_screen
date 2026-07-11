# Codex Task 05 — Hardening, Operations, and Release Candidate

## Goal

Turn the feature-complete MVP into a release candidate with explicit operational limits, CI, runbooks, and production-integration gates.

## Required scope

- full security-header configuration and CSP
- rate-limit implementation and abuse tests
- error-reporting scrubbers or documented adapter
- structured redacted logging and request IDs
- health/readiness endpoints
- outbox and scan queue metrics
- backup/restore runbook
- incident-response runbook
- notification-provider runbook
- evidence-malware runbook
- legal-content publication runbook
- data-retention and deletion-request workflow
- CI pipeline running deterministic quality gates
- dependency and container scanning where supported
- production Dockerfiles without floating tags
- deployment guide with app, worker, DB, storage, scanner, and secrets
- migration and rollback procedure
- seed/demo reset procedure
- load/concurrency test for mission allocation and answer save
- accessibility review and manual mobile QA checklist
- privacy review proving no PII in analytics/logs
- README with exact clean-start commands

## Release gate

Do not label the application “production ready” unless real OTP/SSO, storage, scanner, notification, TLS, backup, monitoring, and counsel-approved content are configured and tested. Instead produce a readiness matrix with statuses:

- implemented locally
- adapter implemented, credentials required
- production test passed
- blocked

## Final validation

Run and report:

- clean install
- migrations
- seed
- lint
- typecheck
- unit tests
- integration tests
- production build
- Playwright client/staff flows
- authorization/security suite
- accessibility smoke suite
- concurrency daily-cap test

Review the final diff as a senior engineer. Fix defects rather than merely listing them.

## Done when

The repository is reproducibly runnable, all deterministic gates pass, runbooks exist, known limitations are explicit, and the readiness matrix does not overstate any external integration.
