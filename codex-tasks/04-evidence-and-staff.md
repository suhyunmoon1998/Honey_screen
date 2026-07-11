# Codex Task 04 — Evidence Pipeline and Staff Workflow

## Goal

Add a secure evidence pipeline and a useful staff intake workflow without exposing unscanned files or crossing client boundaries.

## Required scope

### Evidence

- S3-compatible object-storage adapter with MinIO locally
- presigned direct upload into quarantine
- randomized object keys
- size and declared-type validation before upload intent
- magic-byte/type validation after upload
- malware-scanner interface and local adapter selected by ADR
- fail-closed scan state
- clean-only staff download using short-lived signed URL
- upload progress and processing status
- user description and evidence category
- no raw object paths in client-visible APIs
- authorization on every metadata and download operation

### Staff

- dashboard filters defined in product spec
- client detail with answers grouped by category
- answer revisions and question version reference
- review flags and resolution workflow
- contact requests
- private staff notes
- assignment
- evidence status and clean-only access
- audit timeline
- bilingual printable HTML intake summary
- export authorization and audit event

### Privacy

- generic staff notifications until authenticated
- filenames treated as sensitive metadata
- no evidence details in analytics

## Required tests

- allowed upload, oversize, MIME mismatch, scanner failure, infected result
- clean-only access
- cross-client and cross-organization evidence denial
- signed URL expiry behavior
- staff filters and detail authorization
- notes invisible to clients
- export audit event
- end-to-end client upload to staff clean view using a safe fixture

## Done when

Evidence is never available before a clean result, staff can complete the intended review flow, and negative authorization tests pass.
