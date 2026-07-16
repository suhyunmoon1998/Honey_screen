# ADR-0009: Notification Delivery Worker Claiming and Outcome Semantics

## Status

Accepted.

## Context

Task 03 adds a production-shaped notification worker for staff in-app delivery
and future web-push delivery. The worker must remain correct under retries,
multiple processes, expired leases, non-UTC PostgreSQL sessions, and crash
windows without overstating external guarantees.

## Decision

Use a PostgreSQL-backed notification worker with these rules:

- claim work with `FOR UPDATE SKIP LOCKED`
- store worker instants in the repository’s existing `timestamp without time zone`
  convention, representing UTC instants
- use `statement_timestamp() AT TIME ZONE 'UTC'` as the authoritative database
  time expression for claim eligibility, lease expiry, retry scheduling, and
  finalization
- assign a per-claim `leaseToken` and require compare-and-set finalization on
  `(id, status='PROCESSING', leaseToken)`
- persist one `NotificationDeliveryAttempt` row per monotonic attempt number
- persist one `NotificationProviderReceipt` per `deliveryKey` when the provider
  contract supports a safe durable acceptance record
- model provider idempotency explicitly as `GUARANTEED`, `BEST_EFFORT`, or
  `NONE`
- treat unknown post-dispatch outcomes for `BEST_EFFORT` and `NONE` as
  `AMBIGUOUS`, not `DELIVERED` and not `FAILED_RETRYABLE`
- disable invalid push subscriptions only from the authoritative lease holder
- swallow telemetry sink failures so observability cannot corrupt worker state

## Provider-mode semantics

- `GUARANTEED`: the same `deliveryKey` may be retried after a crash; duplicate
  logical delivery is prevented by the provider contract and the local receipt
  record
- `BEST_EFFORT`: safe automatic retry requires a durable local receipt; unknown
  post-dispatch outcomes become `AMBIGUOUS`
- `NONE`: unknown post-dispatch outcomes become `AMBIGUOUS` and are never
  automatically resent

## Consequences

- The system does not claim universal exactly-once external delivery.
- Ambiguous deliveries require manual reconciliation rather than optimistic
  retry.
- Time-zone-sensitive worker tests are mandatory because the schema stores UTC
  instants in naive timestamp columns.
- Any future move to `timestamptz` must be repository-wide or documented in a
  dedicated migration ADR.
