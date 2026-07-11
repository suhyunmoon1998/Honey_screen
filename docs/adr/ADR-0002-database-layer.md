# ADR-0002: PostgreSQL with Prisma and Targeted Raw SQL

## Status

Accepted for implementation planning.

## Context

The product needs a typed database layer, forward-only migrations, and PostgreSQL-specific concurrency primitives for the daily-cap allocator and worker queue claims.

## Decision

Use:

- PostgreSQL as the primary datastore
- Prisma ORM for schema management, typed client access, and most repositories
- parameterized raw SQL for PostgreSQL-specific paths that Prisma does not model directly enough, especially:
  - `pg_advisory_xact_lock(...)`
  - `FOR UPDATE SKIP LOCKED`
  - selected reporting queries where SQL clarity materially improves correctness

## Rationale

- Prisma gives strong TypeScript ergonomics, mature tooling, and a familiar migration workflow for a greenfield monorepo.
- Official Prisma guidance allows raw SQL where required for unsupported or highly optimized queries.
- The concurrency-sensitive flows in this product benefit from explicit SQL rather than ORM indirection.

## Consequences

- Raw SQL must remain isolated, parameterized, reviewed carefully, and covered by integration tests.
- Repositories must not expose ORM types across package boundaries.
- Connection configuration must use direct PostgreSQL connections for flows that depend on transaction-scoped lock semantics.
