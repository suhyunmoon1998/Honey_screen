# ADR-0003: Auth.js Sessions with Phone-First OTP and Google-Compatible Staff OIDC

## Status

Accepted for implementation planning.

## Context

The product requires two authentication modes:

- client passwordless OTP with mobile phone number as the primary identifier
- staff/admin SSO-capable login compatible with Google Workspace OIDC

It also requires secure session cookies, rotation on auth and privilege change, and server-side authorization on every request.

## Decision

Use Auth.js for session management in `apps/web`, with:

- database-backed sessions
- a custom phone-first OTP verification flow backed by E.164 normalization, hashed verification challenges, resend throttling, and attempt limits
- Google Workspace-compatible OIDC for production staff authentication
- a database-backed staff allowlist and explicit `STAFF` or `ADMIN` role assignment that is checked after authentication
- optional individually allowlisted Gmail accounts when configured
- a development-only local auth path for staff until production OIDC credentials exist
- an OTP provider abstraction that supports SMS and email, while implementing only a secure development OTP provider in Task 01

## Rationale

- Auth.js supports secure cookie/session handling and OIDC integration in Next.js.
- A database allowlist prevents authorization from being inferred solely from Google login success or email-domain membership.
- Separating session management from the OTP provider logic keeps the client flow testable and portable.
- A provider interface lets local development proceed without pretending an external identity integration is already complete.

## Consequences

- OTP challenge storage, throttling, hashing, generic responses, and production no-log guarantees remain application responsibilities and are not delegated blindly to the auth library.
- Authorization must remain in application use cases and repositories, not only in route guards.
- The development staff-auth adapter must be fail-closed in production configuration.
