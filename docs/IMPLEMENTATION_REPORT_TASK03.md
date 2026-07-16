# Implementation Report — Task 03 Notifications

## Scope delivered

Task 03 now covers two accepted checkpoints:

- worker claiming, duplicate-delivery, lease, crash-window, and redaction
  hardening
- Task 03C explicit reminder consent, client notification preferences, web-push
  subscription lifecycle, and time-zone-aware reminder scheduling

This checkpoint does not start SMS reminders, real email delivery, broader
Honey UI redesign, evidence uploads, or malware scanning.

## Worker hardening delivered

- `NotificationIntent`, `NotificationDeliveryAttempt`, and
  `NotificationProviderReceipt` concurrency hardening
- explicit provider modes: `GUARANTEED`, `BEST_EFFORT`, `NONE`
- compare-and-set finalization on `(id, status='PROCESSING', leaseToken)`
- invalid-subscription handling restricted to the authoritative lease holder
- telemetry sink failure isolation
- repeated claim/finalization race coverage

## Reminder and preference delivered

- separate reminder consent records using `MISSION_REMINDER_WEB_PUSH`
- `NotificationPreference` state for per-client reminder enablement
- `ReminderOccurrence` state for one reminder decision per
  `(clientId, purpose, localDate)`
- encrypted push-subscription persistence with transaction-safe enable/disable
- minimal authenticated settings page at `/settings/notifications`
- generic, lock-screen-safe reminder copy only
- scheduler runtime that uses the stored client IANA time zone
- dispatch-time revalidation before provider send

## Scheduling rules

- local date is derived from the stored client time zone
- preferred reminder times must come from an allowlisted set
- quiet hours are enforced and validated
- spring-forward gaps resolve to the first valid instant after the gap
- fall-back overlaps choose the earlier valid instant
- reminder windows expire after a bounded catch-up interval
- same-day scheduling is idempotent under repeated runs and concurrent workers

## Suppression conditions

Reminder delivery is suppressed instead of sent when any of these is true:

- preference disabled
- no active push subscription
- client restricted or deleted
- reminder window expired
- current local time is inside quiet hours
- the local-day substantive-question cap is exhausted
- the mission for that local day is already completed
- there is no eligible approved mission content remaining

## Validation status

Validated during this checkpoint:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm vitest run tests/unit/reminder-domain.unit.test.ts`
- `pnpm vitest run tests/unit/worker-notifications.unit.test.ts`
- `pnpm vitest run tests/integration/reminder-scheduler.integration.test.ts --maxWorkers=1`
- `pnpm vitest run tests/integration/worker-notifications.integration.test.ts --maxWorkers=1`

Additional closeout commands are reported from the final command sweep.

## Known limits

- reminder delivery still uses the test push provider adapter; no real browser
  push delivery service is wired yet
- the notification settings UI is intentionally minimal and does not include
  install-guidance coaching or staff-facing install observability
- reminder scheduling currently supports web push only; SMS remains explicitly
  disabled by configuration guard
