# Task 03 Acceptance Matrix

## Worker concurrency and delivery hardening

| Requirement                                                                           | Status | Evidence                                                                                         |
| ------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| Database time policy is explicit and tested under non-UTC sessions                    | Done   | `docs/LOCAL_DATE_AND_TIME_ZONE.md`, `tests/integration/worker-notifications.integration.test.ts` |
| Concurrent workers claim disjoint batches                                             | Done   | repeated 2-worker and 3-worker claim races                                                       |
| Duplicate terminal outcomes are prevented                                             | Done   | 20 repeated concurrent finalize races                                                            |
| Duplicate logical delivery is prevented                                               | Done   | 20 repeated concurrent logical-delivery finalize races                                           |
| Stale workers cannot mutate intents or subscriptions                                  | Done   | stale-lease invalid-subscription race coverage                                                   |
| Guaranteed-provider crash window safely recovers                                      | Done   | crash-after-acceptance reclaim test                                                              |
| Best-effort and none provider modes represent unknown post-dispatch outcomes honestly | Done   | reclaim-to-`AMBIGUOUS` tests                                                                     |
| Invalid subscriptions are disabled only by authoritative workers                      | Done   | invalid subscription integration and stale-lease race coverage                                   |
| Worker events remain content-free and redacted                                        | Done   | operational redaction and telemetry-failure tests                                                |
| Provider call happens outside the claim transaction                                   | Done   | blocked-provider integration proof                                                               |

## Reminder consent, preferences, and scheduling

| Requirement                                                                        | Status | Evidence                                                                                         |
| ---------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| Reminder consent is explicit and separate from registration/privacy consent        | Done   | `apps/web/src/lib/notification-preferences.ts`, consent records with `MISSION_REMINDER_WEB_PUSH` |
| Client can enable and disable web-push reminders without Honey reward side effects | Done   | preference integration tests assert no Honey point changes                                       |
| Reminder preferences are persisted server-side per client, purpose, and channel    | Done   | `NotificationPreference` schema and API routes                                                   |
| Stored push subscription material remains encrypted and safe to log                | Done   | push-subscription integration test and redacted operational events                               |
| Scheduler creates at most one reminder occurrence per local date under races       | Done   | repeated 2-worker and 3-worker reminder scheduler races                                          |
| Scheduler reruns do not duplicate outbox events or reminder intents                | Done   | reminder scheduler rerun integration coverage                                                    |
| Reminder scheduling uses the stored IANA time zone and deterministic DST rules     | Done   | `tests/unit/reminder-domain.unit.test.ts`                                                        |
| Reminder delivery is revalidated at dispatch time                                  | Done   | suppression-after-disable integration test                                                       |
| Quiet hours and catch-up windows suppress stale reminders                          | Done   | scheduler/dispatch suppression logic plus domain tests                                           |
| Reminder push text is generic and avoids legal or case-merit claims                | Done   | reminder payload templates in scheduler and docs                                                 |

## Out of scope for Task 03

- SMS reminders
- real email reminders
- install-guidance expansion
- staff install observation UI
- broader Honey UI redesign
- evidence uploads
- malware scanning
