# Codex Task 02 — Question Engine and Daily Cap

## Goal

Generalize the mission engine into a deterministic, versioned, server-enforced system that supports 3/5/10 missions and never presents more than 10 distinct substantive questions per client local day.

## Required scope

- versioned JSON rule DSL with strict schema validation
- pure domain evaluator with typed failures
- mission slot allocation after each answer
- immutable allocated question version
- deterministic candidate scoring and tie-break
- sensitivity and effort pacing
- quick/standard/full mission sizing
- mission extension within remaining daily budget
- IANA time-zone local-date calculation
- concurrency-safe `DailyQuestionInteraction`
- database lock/transaction strategy from the approved ADR
- no repeated answered question unless explicitly marked clarification
- review-flag creation through deterministic rules
- category completion projection
- DRAFT/APPROVED/RETIRED content lifecycle
- production guard against DRAFT content
- representative bilingual question bank across the approved categories; all legal content remains DRAFT until counsel approval
- admin-only content preview and publication controls, if included in the approved plan

## Required tests

- property or table-driven rule evaluator tests
- all supported operators and malformed rules
- 3/5/10 sizing
- mission extension
- no repeats
- branch follow-up and skip
- snapshot/version stability after publishing a new question version
- two concurrent requests at remaining budget 1
- multiple tabs and retry behavior
- DST boundary and time-zone cases
- review-flag idempotency
- sensitivity pacing

## Done when

The daily-cap invariant is proven at both domain and database-integration levels, and all relevant acceptance cases in `docs/ACCEPTANCE_TESTS.md` pass.
