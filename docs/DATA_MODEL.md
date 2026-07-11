# Data Model — Logical Schema

Names are illustrative; the implementation may adjust naming while preserving invariants.

## Identity and tenancy

### Organization

- id
- name
- default time zone
- retention policy
- created at

### User

Internal staff/admin identity.

- id
- external subject
- status
- created at

### OrganizationMembership

- organization ID
- user ID
- role: STAFF or ADMIN
- created at

### Client

- id
- organization ID
- encrypted contact fields
- normalized contact lookup hash where needed
- preferred locale
- IANA time zone
- status
- created/updated timestamps

### ClientIdentity

- client ID
- provider
- provider subject
- verified timestamp

### Invitation

- id
- organization ID
- token hash
- intended contact hash
- expires at
- accepted at
- revoked at

### ConsentRecord

Append-only.

- id
- client ID
- consent type
- granted/withdrawn
- policy version
- locale
- timestamp
- source metadata

### Session / VerificationChallenge

Use the selected auth library’s schema where possible. Verification challenge must include hashed OTP, attempt count, expiry, and consumed timestamp.

## Intake

### Matter

- id
- organization ID
- client ID
- status
- currently employed
- employer summary fields
- employment dates
- primary work city
- assigned staff ID
- created/updated timestamps

### ContactRequest

- matter ID
- requested channel
- safe time
- status
- created/resolved timestamps

## Question content

### QuestionDefinition

Stable identity.

- id
- organization ID
- stable key
- category
- is administrative
- created at

### QuestionVersion

Immutable after publication.

- id
- definition ID
- version number
- answer type
- ES text
- EN text
- answer schema JSON
- priority
- emotional weight
- estimated effort
- active from / active until
- created by staff ID
- approved by staff ID
- approved at
- retired at
- fictional seed marker
- legal review status
- display order

### QuestionOption

- question version ID
- option key
- value
- label ES
- label EN
- display order

### BranchRule

- question version ID
- target definition key
- priority
- declarative rule JSON

### ReviewFlagRule

- question version ID
- flag type
- declarative rule JSON
- priority
- sensitivity
- effort
- legal review status
- published/retired timestamps

### QuestionCategory

- key
- localized label
- display order

## Missions and answers

### Mission

- id
- organization ID
- client ID
- mission kind: QUICK, STANDARD, FULL
- requested size
- state
- locale
- local date
- created/started/completed timestamps

### MissionSlot

- id
- mission ID
- position
- question definition ID
- question version ID
- state
- counts toward daily cap
- clarification marker
- allocated/presented/answered timestamps

Unique `(mission_id, position)`.

### DailyQuestionLedger

- id
- organization ID
- client ID
- local date
- question definition ID
- question version ID
- mission slot ID
- counted at

Unique `(client_id, local_date, question_definition_id)` and unique
`(mission_slot_id)`.

### AnswerRevision

Append-only.

- id
- organization ID
- client ID
- mission slot ID
- question version ID
- revision number
- validated normalized value JSON
- idempotency key
- created local date
- created at

Unique `(mission_slot_id, revision_number)` and `(client_id, idempotency_key)`.

### AnswerCurrent

Optional projection for efficient reads.

- mission slot ID
- latest revision ID
- updated at

## Review and staff work

### ReviewFlag

- id
- organization ID
- client ID
- mission slot ID
- answer revision ID
- type
- state: OPEN, ACKNOWLEDGED, RESOLVED, DISMISSED
- created timestamp

### ClarificationRequest

- id
- organization ID
- client ID
- question definition ID
- requested by staff ID
- reason code
- state
- created at
- resolved at

### IdempotencyRecord

- id
- organization ID
- client ID
- scope
- key
- request hash
- resource type / resource ID
- response JSON
- expires at
- created at

### StaffNote

- id
- matter ID
- author ID
- body stored as sensitive data
- created/updated timestamps

### AuditEvent

Append-only application event.

- id
- organization ID
- actor type / actor ID
- action
- target type / target ID
- metadata JSON
- created at
- actor type and opaque actor ID
- action
- target type and ID
- request ID
- redacted metadata JSON
- created at

## Honey progression

### ProgressEvent

Append-only and idempotent.

- id
- client ID
- event type
- points
- source type and ID
- idempotency key
- created at

### RewardDefinition

- key
- localized names
- asset reference
- unlock rule
- active status

### RewardGrant

- client ID
- reward key
- source progress event
- granted at

Unique `(client_id, reward_key)` unless a reward is explicitly repeatable.

## Notifications and devices

### DeviceInstallation

- id
- client ID
- anonymous device ID
- platform hints
- first seen
- standalone first launch
- last seen

Do not use fingerprinting.

### PushSubscription

- id
- device installation ID
- endpoint encrypted or protected
- keys
- status
- created/revoked timestamps

### Notification

- id
- recipient type/ID
- template key
- locale
- redacted template parameters
- channel
- status
- scheduled at
- created at

### NotificationDeliveryAttempt

- notification ID
- provider
- provider message ID
- attempt number
- status
- error class
- timestamps

### OutboxEvent

As described in architecture.

## Evidence

### EvidenceDocument

- id
- organization ID
- client ID
- matter ID
- category
- user description
- original filename encrypted or protected
- declared and detected MIME type
- size
- storage object key
- state: PENDING_UPLOAD, QUARANTINED, SCANNING, CLEAN, REJECTED, DELETED
- created/updated timestamps

### EvidenceScan

- evidence ID
- scanner
- result
- signature/version
- completed at
- redacted diagnostic code

## Analytics

Store only allowlisted event names and opaque IDs. Never store answer values, employer name, contact data, filenames, or free text in analytics payloads.
