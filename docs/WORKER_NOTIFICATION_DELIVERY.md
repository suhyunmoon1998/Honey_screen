# Worker Notification Delivery

## Claim SQL strategy

The worker claims ready notification intents with:

- `FOR UPDATE SKIP LOCKED`
- ordered readiness by `COALESCE(retryAt, availableAt), createdAt, id`
- queue eligibility:
  `status IN ('QUEUED', 'FAILED_RETRYABLE')`
- reclaim eligibility:
  `status = 'PROCESSING' AND leaseExpiresAt <= statement_timestamp() AT TIME ZONE 'UTC'`
- monotonic attempt increment inside the claim transaction
- per-claim `leaseToken`

## Compare-and-set finalization

Authoritative finalization updates only rows matching:

- `id = ?`
- `status = 'PROCESSING'`
- `leaseToken = ?`

If the update count is zero, the worker reports lease loss and does not mutate
the intent, attempt, or push subscription.

## Provider receipt semantics

`NotificationProviderReceipt` is a durable local record of a provider adapter’s
accepted logical delivery where that guarantee is safe to represent.

Current rules:

- unique key: `deliveryKey`
- retries reuse the same `deliveryKey`
- duplicate persistence resolves to the existing receipt via `upsert`
- message content is never persisted
- raw provider responses are never persisted
- safe provider references may be stored only when they do not contain
  sensitive material
- receipt existence does not claim device display or user attention

## Retry and ambiguous-outcome policy

- retryable failures become `FAILED_RETRYABLE` with bounded exponential backoff
- retries never occur before `retryAt`
- attempts beyond `maxAttempts` become `FAILED_PERMANENT`
- invalid subscriptions become `INVALID_SUBSCRIPTION` and are not retried
- `AMBIGUOUS` outcomes are not retried automatically

## Reminder occurrence projection

Mission reminders now flow through a two-stage process:

- scheduler writes one `ReminderOccurrence` per local client day
- planned occurrences upsert one outbox row by
  `reminder-occurrence:<occurrenceId>:outbox:v1`
- outbox projection creates one `NotificationIntent` with
  `deliveryKey = mission-reminder:<occurrenceId>:v1`

This keeps local-day reminder scheduling idempotent even when the scheduler or
worker is restarted repeatedly.

## Dispatch-time reminder suppression

Reminder intents are revalidated immediately before provider send. Delivery is
suppressed when:

- the preference is disabled
- no active subscription remains
- the client is restricted or deleted
- the occurrence expired
- current local time is inside quiet hours
- the local-day question cap is already exhausted
- the local-day mission is already completed
- no eligible approved mission content remains

Suppression updates both the intent and the related occurrence so later worker
passes do not overstate delivery.

## Provider-mode capability summary

| Mode          | Automatic retry after unknown post-dispatch crash | Outcome representation                     |
| ------------- | ------------------------------------------------- | ------------------------------------------ |
| `GUARANTEED`  | Allowed with the same `deliveryKey`               | eventual authoritative terminal state      |
| `BEST_EFFORT` | Not assumed safe without durable local evidence   | `AMBIGUOUS` when outcome cannot be bounded |
| `NONE`        | Not allowed                                       | `AMBIGUOUS`                                |
