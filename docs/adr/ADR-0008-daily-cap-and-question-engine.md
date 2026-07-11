# ADR-0008: Daily Question Ledger and Immutable Versioned Question Engine

## Status

Accepted for Task 02 implementation.

## Context

Task 02 must enforce a maximum of 10 distinct substantive client questions per
client local calendar day under concurrent requests while also introducing:

- immutable question versioning
- branching eligibility
- deterministic mission snapshots
- idempotent mission creation
- auditable content approval and retirement

The cap must remain correct across retries, multiple tabs, multiple devices,
and overlapping mission-create requests. The solution must rely on PostgreSQL,
not frontend counters, in-memory locks, or eventual consistency.

## Decision

Use a PostgreSQL-backed `DailyQuestionLedger` plus transaction-scoped advisory
locking keyed by `(client_id, local_date)`, bounded mission-slot constraints,
and immutable mission snapshots.

Mission creation flow:

1. Resolve the client local date on the server from the stored IANA time zone.
2. Begin a database transaction.
3. Acquire a transaction-scoped advisory lock for `(client_id, local_date)`.
4. Resolve any active mission first and return it idempotently if one exists.
5. Load unanswered eligible `APPROVED` question versions through the
   deterministic selector.
6. Filter out questions already counted in the same-day ledger unless they are
   explicit clarifications.
7. Limit selection to the requested mission size and the remaining daily
   allowance, capped at 10 total distinct substantive questions.
8. Create the mission snapshot and its ordered mission items in the same
   transaction.
9. Insert one ledger row per counted question definition with a unique
   constraint on `(client_id, local_date, question_definition_id)`.
10. Commit and return the immutable snapshot.

Closeout additions:

- `Mission_requestedSize_range_chk` bounds mission size to `1..10`
- `MissionSlot_position_range_chk` bounds mission-slot ordinal to `1..10`
- `MissionSlot_missionId_questionDefinitionId_key` prevents duplicate question
  definitions in one mission
- operational telemetry is emitted through an `OperationalEventSink`, separate
  from `AuditEvent`

Reopening an already-counted question does not consume another unit because the
ledger key is per definition per client-day. Current-mission resume never
rewrites the snapshot. New branch eligibility affects future mission creation,
not the already-created mission.

## Rationale

- The ledger is auditable and explains exactly why a client has reached the
  cap on a specific local date.
- Advisory locking serializes the high-risk critical section without requiring
  long-lived application memory or extra infrastructure.
- A unique ledger key turns “same question reopened” into a database-enforced
  no-op instead of a best-effort count.
- Immutable mission items preserve history even after later approvals or
  retirements.
- Selecting and counting inside one transaction prevents exposing an 11th
  distinct substantive question under concurrent mission creation.

## Consequences

- Mission creation becomes the authoritative point where daily substantive
  budget is reserved.
- A client can reserve fewer than 10 slots if fewer eligible questions remain.
- Questions already counted on a day are not newly counted again that same day,
  even if reopened from the same mission.
- Time-zone changes must be audited and only affect future local-date
  calculations.
- Integration tests must exercise real PostgreSQL concurrency and repeat the
  daily-cap race multiple times.
- Demo seed content must be guarded behind an explicit environment flag and must
  fail closed in production.
