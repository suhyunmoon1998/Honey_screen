# Question Engine

## Selection inputs

The selector uses:

- mission kind: `QUICK`, `STANDARD`, `FULL`
- remaining daily allowance
- previously answered definition IDs
- already-counted same-day definition IDs
- open clarification requests
- branch-rule context derived from saved answers

## Selection order

1. explicit clarifications
2. unanswered foundational questions needed for future branches
3. high-priority foundational questions
4. category coverage gaps
5. eligible follow-up detail questions

Tie-breakers are deterministic and stable. The selector never uses randomness.

## Exclusions

The selector excludes:

- `DRAFT` and `RETIRED` versions
- answered questions unless clarification is open
- questions already counted that day
- branch-ineligible questions
- administrative questions from the substantive daily-cap count

## Snapshot rule

Once a mission is created, its slot order and question version IDs never change.
Later content approval, retirement, or new branch eligibility can only affect a
future mission.

## Database invariant evidence

The eleventh distinct substantive question is prevented by a combination of:

- transaction boundary: `getOrCreateMission` reserves the mission snapshot and
  same-day ledger rows in one PostgreSQL transaction
- lock: `pg_advisory_xact_lock(hashtext(client_id), hashtext(local_date))`
- unique constraints:
  - `DailyQuestionLedger_clientId_localDate_questionDefinitionId_key`
  - `DailyQuestionLedger_missionSlotId_key`
  - `MissionSlot_missionId_position_key`
  - `MissionSlot_missionId_questionDefinitionId_key`
- check constraints:
  - `Mission_requestedSize_range_chk`
  - `MissionSlot_position_range_chk`
- idempotency constraints:
  - `IdempotencyRecord_clientId_scope_key_key`
  - `AnswerRevision_clientId_idempotencyKey_key`
  - `ProgressEvent_idempotencyKey_key`

The exact concurrency proof is
`tests/integration/question-engine.integration.test.ts`:
`concurrent mission creation never exceeds 10 daily slots`.
