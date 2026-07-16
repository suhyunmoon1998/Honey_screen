# Local Date and Time-Zone Behavior

## Source of truth

- timestamps are stored in UTC
- client profile stores the IANA time zone
- the server derives local date from the stored IANA zone
- browser-supplied local dates are ignored

## Daily-cap behavior

- the 10-question cap is keyed by `(client_id, local_date)`
- time-zone changes do not rewrite or erase existing ledger rows
- a new allowance begins only when the server-derived local date changes

## Auditing

Changing the client time zone creates a `CLIENT_TIME_ZONE_CHANGED` audit event
with previous and next zone values.

## DST expectation

DST transitions change the derived local date boundary timing, but they do not
change the rule that the budget is enforced per derived local calendar date.

## Reminder scheduling

- reminder scheduling also uses the stored client IANA time zone
- nonexistent spring-forward local times resolve to the first valid instant
  after the DST gap
- ambiguous fall-back local times resolve to the earlier valid instant
- reminder occurrence uniqueness is still keyed by the derived local calendar
  date, not by UTC date

## Worker database-time policy

The notification worker currently follows the repository-wide timestamp
convention rather than introducing a partial `timestamptz` migration:

- worker instants are stored in `timestamp without time zone`
- those values represent UTC instants by convention
- claim eligibility, lease expiry, retry eligibility, and finalization compare
  against `statement_timestamp() AT TIME ZONE 'UTC'`
- worker code must never compare those UTC-naive columns against
  session-local `CURRENT_TIMESTAMP`
- retry delays may be computed in application code, but persisted `retryAt`
  values are anchored from database time

This policy is covered by integration tests that execute the same worker claim
scenario after `SET TIME ZONE 'UTC'`, `SET TIME ZONE 'America/Los_Angeles'`,
and `SET TIME ZONE 'Asia/Seoul'`.
