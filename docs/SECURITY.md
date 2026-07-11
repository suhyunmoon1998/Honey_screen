# Security and Privacy Requirements

## 1. Data classification

### Highly sensitive

- answers and free text
- employer and employment information
- evidence files
- staff notes
- contact information
- notification endpoints

### Sensitive operational

- invitation tokens
- OTP challenges
- session IDs
- audit trails
- review flags

### Public

- marketing copy
- Honey public image assets
- generic legal disclaimers

## 2. Principal threats

1. Cross-client or cross-organization IDOR
2. Staff privilege escalation or unauthorized browsing
3. OTP brute force, abuse, and account enumeration
4. Stolen or replayed invitation links
5. XSS through free text or filenames
6. CSRF and session fixation
7. Malicious or oversized file upload
8. Notification leakage on lock screens
9. PII leakage through logs, analytics, error reporting, or URLs
10. Service-worker caching of authenticated content
11. Race condition bypassing the 10-question cap
12. Duplicate outbox delivery or reward grants
13. Unauthorized evidence export
14. Compromised dependencies or secrets
15. Unreviewed legal content published to clients

## 3. Required controls

### Authorization

- deny by default
- server-side actor context
- organization scoping in every repository path
- explicit client ownership checks
- staff role and assignment policy
- per-request ADMIN enforcement for content approval and retirement
- audit client-detail reads and exports
- test all negative authorization paths

### Authentication

- vetted library/provider
- short-lived, hashed, single-use OTP
- per-account and per-IP throttles
- generic responses to prevent enumeration
- secure session cookies
- session rotation after verification
- staff MFA through production identity provider

### Input and output

- schema validation at route and domain boundaries
- output escaping by framework defaults
- sanitize or render staff notes/free text as plain text
- never inject user content as HTML
- allowlist redirect destinations

### HTTP security

- HTTPS-only production
- HSTS after deployment validation
- strict CSP with nonces or hashes where required
- `frame-ancestors 'none'` unless an approved embed use case exists
- `X-Content-Type-Options: nosniff`
- restrictive Referrer-Policy
- Permissions-Policy
- `Cache-Control: no-store` on sensitive routes

### Evidence

- direct-to-quarantine upload
- short-lived presigned URLs
- random object keys
- server-side size and magic-byte checks
- malware scanning before staff access
- no inline rendering of untrusted active content
- `Content-Disposition: attachment` for risky formats
- authenticated, short-lived downloads

### Secrets

- environment validation
- no secrets in repo, client bundles, logs, or test snapshots
- production secrets in managed secret store
- documented rotation procedure

### Logging and observability

- structured redacted logs
- error reporting scrubbers
- no request-body logging on sensitive routes
- no raw provider payload persistence unless redacted and justified
- no answer values, question free text, contact fields, or document names in
  outbox payloads

## 4. Service worker policy

The service worker must not cache authenticated HTML or API traffic. Add tests that log in, access an answer page, inspect cache storage, and prove the response is absent. Logout should clear application-managed caches and in-memory client state.

Task 02 does not change this policy. The accepted design keeps all mission,
answer, and staff routes dynamic with `no-store` behavior and does not add
client-side answer persistence to `localStorage`.

## 5. Notification privacy

Push, SMS, and email preview text must be generic. Details are shown only after authenticated app entry. Store consent version and channel. Respect revocation and quiet hours.

## 6. Legal-content governance

- DRAFT content is hidden in production.
- Publishing requires ADMIN and creates an audit event.
- Published versions are immutable.
- A rollback retires a version and activates another; it does not edit history.
- STAFF read access does not imply publish rights.

## 7. Retention and deletion

- organization-configurable retention policy
- deletion request workflow with review and legal hold support
- evidence lifecycle and object deletion verified asynchronously
- audit records retained according to policy
- backup expiry documented

## 8. Production hardening checklist

- [ ] Production OTP provider enabled; dev OTP disabled
- [ ] Staff SSO and MFA enabled
- [ ] TLS and security headers verified
- [ ] Database encryption and backups enabled
- [ ] Restore test completed
- [ ] Private object storage and bucket policies reviewed
- [ ] Malware scanner live and fail-closed
- [ ] Notification provider callbacks authenticated
- [ ] Rate limits and abuse monitoring enabled
- [ ] Error reporting scrubbers tested with synthetic PII
- [ ] Dependency and container scans in CI
- [ ] Cross-tenant security tests pass
- [ ] Service-worker sensitive-cache test passes
- [ ] Incident contacts and runbooks documented
- [ ] Counsel approved production legal content and privacy terms

## 9. Incident basics

Document:

- severity levels
- containment steps
- session and token revocation
- notification provider shutdown
- evidence access suspension
- log preservation
- client notification decision path
- post-incident review
