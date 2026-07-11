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
