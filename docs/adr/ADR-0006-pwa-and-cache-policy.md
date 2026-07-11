# ADR-0006: Conservative PWA with Static Offline Shell Only

## Status

Accepted for implementation planning.

## Context

The product wants installable PWA behavior and honest install tracking, but it also forbids caching authenticated content, answers, evidence, and staff pages.

## Decision

Implement a conservative PWA strategy:

- valid manifest and icons
- standalone mode where supported
- static offline shell only
- no service-worker caching of authenticated routes or API traffic
- separate install-confidence events rather than a single “app installed” flag

## Rationale

- Minimizes privacy and stale-data risks.
- Aligns with the requirement that sensitive content must never be cached.
- Avoids misleading staff claims about installation certainty across browsers.

## Consequences

- The PWA provides installability and offline branding, not offline answer editing.
- Sensitive routes must explicitly return `Cache-Control: no-store`.
- Browser-level cache inspection tests are required to prevent regressions.
