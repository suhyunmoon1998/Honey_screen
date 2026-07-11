# Codex Task 00 — Repository Assessment, RFC, and Execution Plan

Use Plan mode. Do not implement product features in this task.

## Goal

Turn the attached product and architecture documents into a repository-specific implementation plan that a senior engineer could review before coding.

## Context

Read, in full:

- `AGENTS.md`
- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/SECURITY.md`
- `docs/ACCEPTANCE_TESTS.md`
- the entire existing repository structure and relevant config

The Honey source image is at `assets/honey-source.png`.

## Work

1. Inspect the repository, package manager, framework, tests, CI, current auth, and deployment assumptions.
2. Identify conflicts between the existing codebase and the requested architecture.
3. Create or update:
   - `docs/RFC-001-honey-mvp.md`
   - `docs/EXECUTION_PLAN.md`
   - ADRs for architecture style, database layer, authentication, object storage, background jobs/outbox, PWA strategy, and localization.
4. In the RFC, include:
   - system context and component diagram
   - exact package boundaries
   - request and background-event flows
   - server-side daily-cap algorithm with transaction/locking strategy
   - question-version and branching design
   - authentication and authorization model
   - evidence quarantine/scan flow
   - PWA cache policy
   - install-event confidence semantics
   - notification delivery semantics
   - privacy/logging rules
   - migration and rollback strategy
   - test pyramid and CI gate
   - production dependencies not available locally
5. In the execution plan, divide work into small vertical milestones. Each milestone must produce a runnable application and list:
   - files/packages affected
   - schema changes
   - acceptance tests
   - commands to validate
   - rollback point
6. Create a risk register with probability, impact, mitigation, and owner category.
7. Do not claim an external integration is complete without credentials and a real test.
8. Do not write application code yet.

## Done when

- The repository has a reviewable RFC, ADRs, execution plan, and risk register.
- Decisions are concrete rather than “TBD” unless truly blocked.
- Every non-negotiable invariant in `AGENTS.md` maps to an implementation and a test.
- You report any blocking decision that requires human approval.
