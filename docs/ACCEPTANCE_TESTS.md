# Acceptance and Quality Gates

## A. Client vertical slice

Given a valid Spanish invitation:

1. Client opens invitation.
2. Client sees Spanish by default and can switch to English.
3. Client verifies with a development OTP.
4. Client records consent and minimal onboarding.
5. Client chooses a five-question mission.
6. Exactly one question is shown at a time.
7. Each answer shows saving, then saved.
8. Refresh after question 2 preserves answers and current mission.
9. Logging out and back in preserves progress.
10. Mission completes after five distinct questions.
11. Honey receives one deterministic reward.
12. Staff dashboard shows registration, mission start, and completion.
13. Client can also choose a 3-question quick mission or a full mission capped
    by remaining daily allowance.

## B. Daily cap

- Requesting a 10-question mission creates at most 10 daily interactions.
- A second tab cannot open an 11th distinct question.
- Two concurrent requests at remaining budget 1 result in only one new interaction.
- Reopening the same question does not consume a second unit that day.
- Extending a 3-question mission can reach 5 or 10 but never 11.
- Local date uses the stored IANA time zone and handles DST transitions.

## C. Branching

- A qualifying answer causes the next eligible follow-up to be selected.
- A non-qualifying answer skips that follow-up.
- Previously allocated slots never change after content is republished.
- Malformed rules fail closed and are not served.
- High-sensitivity questions are not presented consecutively when a lower-sensitivity eligible choice exists.

## D. Answer integrity

- Duplicate idempotency key does not create duplicate revisions.
- Conflicting edit returns an explicit conflict and does not silently overwrite.
- Answer value is validated against the immutable question version.
- Review flags are idempotent.

## E. Honey progression

- Points are awarded once per source event.
- No inactivity event removes points or rewards.
- Progress is unchanged by review-flag severity.
- Reward copy contains no legal conclusion.

## F. PWA and install

- Manifest is valid.
- App can run in standalone mode on a supported browser.
- Install UI is hidden where unsupported.
- Standalone first launch is recorded once per device installation.
- Staff language distinguishes prompt acceptance from confirmed standalone launch.
- Authenticated responses are absent from service-worker caches.

## G. Notifications

- Source transaction and outbox event commit atomically.
- Worker retry does not duplicate notification records.
- Lock-screen copy contains no employer name, category, or answer.
- Revoked push subscription is not used.
- Stub providers are clearly labeled and never report real delivery.

## H. Evidence

- Allowed file uploads to quarantine.
- MIME mismatch is rejected after sniffing.
- Oversized file is rejected.
- Staff cannot download PENDING, SCANNING, or REJECTED evidence.
- CLEAN evidence gets an authorized short-lived URL.
- One client cannot access another client’s evidence ID or URL.

## I. Authorization

Test matrix for CLIENT, STAFF, ADMIN, anonymous:

- client can access only own matter
- staff access requires same organization and policy permission
- admin functions require admin role
- staff can view content but cannot approve or retire versions
- admin can create draft, approve draft, and retire version with audit trail
- anonymous cannot access authenticated routes
- organization ID supplied by browser is ignored
- client-detail view and export create audit events

## J. Accessibility

- primary pages have no serious automated axe violations
- keyboard-only completion works
- focus order is logical
- save status is announced
- text remains usable at 200% zoom
- reduced motion disables nonessential animation
- ES/EN `lang` attributes are correct

## K. CI gate

Required before merge:

```text
format check
lint
typecheck
unit tests
integration tests
production build
targeted Playwright suite
security regression tests
```

A single `pnpm verify` command should run the deterministic local gate.
