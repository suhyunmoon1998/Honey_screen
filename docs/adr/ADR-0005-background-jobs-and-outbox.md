# ADR-0005: Transactional Outbox with PostgreSQL-Backed Worker

## Status

Accepted for implementation planning.

## Context

Notifications, evidence scanning, and similar side effects must be reliable, idempotent, and coupled safely to source transactions without losing events on crashes.

## Decision

Use a transactional outbox table in PostgreSQL and a separate worker process that:

- claims jobs with `FOR UPDATE SKIP LOCKED`
- retries with backoff and jitter
- stores redacted payloads only
- dead-letters repeated failures
- uses provider-specific idempotency keys
- supports staff in-app notifications as the first implemented notification channel
- keeps email and web-push behind provider abstractions
- limits SMS in the MVP architecture to OTP, with reminder SMS behind a disabled feature flag

## Rationale

- Keeps event creation atomic with the source write.
- Avoids introducing a second queueing system before it is necessary.
- Matches the product requirement for reliable retryable notifications and scan orchestration.
- Lets Task 01 implement real user-visible notification behavior without claiming external delivery.

## Consequences

- The outbox schema becomes a core operational dependency and must have metrics and runbooks by Milestone 5.
- Worker handlers must be deterministic and idempotent.
- Long-running or CPU-heavy scan work may later justify extraction, but not before the MVP proves the need.
- Console or stub adapters must never be reported as real delivery.
