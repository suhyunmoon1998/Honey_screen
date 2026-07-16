# ADR-0010: Reminder Consent and Local-Time Scheduling

## Status

Accepted.

## Context

Task 03C adds client mission reminders. The product requires explicit reminder
consent, generic lock-screen-safe content, and scheduling based on the stored
client IANA time zone. The design must remain correct under retries,
concurrent scheduler runs, preference changes after scheduling, and DST
transitions.

## Decision

Use these repository rules for reminder delivery:

- treat reminder consent as separate from registration, privacy, and general
  messaging consent
- persist one `NotificationPreference` row per
  `(clientId, purpose, channel)`
- persist one `ReminderOccurrence` row per
  `(clientId, purpose, localDate)`
- schedule from the stored client IANA time zone, never from browser-supplied
  local dates
- allow reminder times only from a validated config allowlist
- enforce quiet hours and bounded catch-up windows
- project reminder occurrences into the existing outbox and notification worker
  pipeline rather than bypassing it
- revalidate preference, subscription, quiet hours, daily-cap, mission state,
  and content eligibility immediately before provider send
- suppress stale reminders rather than sending them optimistically

## DST policy

- nonexistent spring-forward local times resolve to the first valid instant
  after the gap
- ambiguous fall-back local times resolve to the earlier valid instant
- the local calendar date remains the authoritative reminder-date key

## Consequences

- reminder planning is idempotent across repeated scheduler passes and process
  races
- a scheduled reminder may still be suppressed at dispatch time if the client
  completed work or changed preferences after planning
- push reminder copy must remain generic because lock-screen text is treated as
  sensitive exposure risk
- future SMS or email reminders must reuse the same consent and occurrence
  model or document a deliberate divergence
