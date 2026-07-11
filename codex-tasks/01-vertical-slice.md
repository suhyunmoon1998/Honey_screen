# Codex Task 01 — Secure Vertical Slice

Implement the first end-to-end slice only after Task 00 documents are approved.

## Goal

A Spanish client can accept an invitation, verify identity using a development OTP provider, complete onboarding, choose and complete a three-question mission, refresh/resume, see Honey progress, and have a staff user see the activity.

## Required scope

- repository/workspace foundation from the approved ADRs
- environment validation and `.env.example`
- PostgreSQL migrations and seed data
- development-only client OTP provider
- development-only staff login or approved local OIDC substitute
- secure session and server-side role authorization
- invitation acceptance with hashed, expiring token
- versioned consent record
- minimal onboarding
- ES-default / EN switch with typed catalogs
- Honey asset copied to the public brand path and rendered accessibly
- mission selection for 3 questions
- immutable question versions with at least 8 representative DRAFT seed questions
- one question per screen
- server-side answer validation, autosave, idempotency, revision history
- pause, refresh, logout, and resume
- mission completion and one idempotent Honey reward
- transactional outbox events for registration, mission start, answer saved, and mission completion
- staff dashboard showing the sample client and timeline
- audit events for staff client-detail access

## Explicit exclusions

- no evidence upload yet
- no real SMS/email/push provider
- no claim that PWA installation is tracked
- no broad 40-question content bank yet
- no automated legal conclusions

## Required tests

- invitation expiry/replay
- OTP throttling and single use
- client/staff authorization boundaries
- answer idempotency and resume
- immutable question version reference
- reward idempotency
- ES/EN smoke tests
- Playwright mobile vertical slice

## Quality bar

- no sensitive request-body logging
- no `localStorage` for answers
- explicit saving/saved/error UI
- 44×44 touch targets
- accessible focus and labels
- production build, lint, typecheck, and tests pass

## Done when

The exact vertical slice works from a clean checkout using documented commands, seed credentials are clearly development-only, and `pnpm verify` passes.
