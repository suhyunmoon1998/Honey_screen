# ADR-0004: S3-Compatible Quarantine/Clean Evidence Storage

## Status

Accepted for implementation planning.

## Context

Evidence files are high-risk inputs and must remain unavailable to staff until malware scan status is `CLEAN`. Local development also needs a reproducible storage environment.

## Decision

Use S3-compatible object storage with:

- MinIO for local development
- separate quarantine and clean prefixes or buckets
- randomized object keys
- short-lived presigned upload URLs for client direct upload
- short-lived presigned download URLs for authorized staff access to clean files only
- a provider-neutral `MalwareScanner` interface with ClamAV as the initial local-development and early-infrastructure target

## Rationale

- S3-compatible APIs are widely supported and easy to reproduce locally.
- Quarantine and clean separation matches the required fail-closed evidence policy.
- Direct upload avoids routing large file bodies through the web server.
- A provider-neutral scanner interface preserves a path to managed scanning later without widening MVP scope now.

## Consequences

- Filenames must be treated as sensitive metadata and never used as storage keys.
- The worker must verify actual file type via magic bytes after upload.
- Production upload processing must fail closed if no real scanner is configured.
- `ERROR`, `TIMEOUT`, `UNKNOWN`, and `INFECTED` files must remain inaccessible.
