# Content Versioning Workflow

## Roles

- `STAFF`: read-only access to question content
- `ADMIN`: may create drafts, approve drafts, and retire versions

## Workflow

1. ADMIN opens the content screen and chooses a definition.
2. Draft creation clones the latest approved rule, option, and metadata shape
   into a new `DRAFT` version with new bilingual prompt text.
3. The ADMIN screen shows a read-only approved-versus-draft comparison for:
   Spanish text, English text, answer type, category, priority, emotional
   weight, estimated effort, options, branch rules, and review-flag rules.
4. Comparison rows use explicit `ADDED`, `REMOVED`, `CHANGED`, or `SAME`
   indicators and do not rely on color alone.
5. Approval validates rule grammar, referenced targets, and option-backed rule
   values before publishing.
6. Approval retires any currently approved version for that definition and marks
   the draft `APPROVED`.
7. Retirement marks a version `RETIRED` without deleting history.
8. Every draft, approval, and retirement action creates an audit event.

## Invariants

- Approved content is immutable.
- New client missions may only use `APPROVED` versions.
- Existing mission snapshots remain readable even after retirement.

## Demo and production content

- Fictional demo question content loads only when `ALLOW_DEMO_CONTENT=true`.
- Demo content is allowed only in `development` or `test`.
- Production must import legally reviewed content through a real ADMIN approval
  workflow rather than seeding fictional approved versions.
