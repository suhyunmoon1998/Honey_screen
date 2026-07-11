# ADR-0001: Modular Monolith with Worker

## Status

Accepted for implementation planning.

## Context

The repository currently has no codebase to preserve. The product requires tight transactional guarantees across invitations, missions, answers, review flags, progression grants, and outbox events, while also needing background work for notifications and evidence scanning.

## Decision

Use a modular monolith with:

- `apps/web` for the Next.js App Router application and server/BFF responsibilities
- `apps/worker` as a separate process for outbox and evidence work
- framework-independent domain packages under `packages/`

## Rationale

- Preserves transactional consistency around answer saves and event creation.
- Keeps operational complexity appropriate for an MVP.
- Allows later extraction of worker responsibilities without rewriting core domain rules.

## Consequences

- Boundaries must be enforced by package imports and code review.
- Cross-module interactions should go through explicit interfaces, not convenience imports.
- Scaling is process-level first: web and worker can scale independently before any service extraction.
