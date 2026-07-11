# ADR-0007: Typed Catalog Localization with Spanish Default

## Status

Accepted for implementation planning.

## Context

Spanish must be the default client language while English remains fully available. The repository also needs durable guardrails against scattered strings and untranslated states.

## Decision

Use a typed message-catalog approach with:

- `es` as the default client locale
- `en` as the secondary locale
- message keys and catalogs stored in `packages/i18n`
- locale-aware formatting helpers for dates and numbers
- tests that fail when required keys are missing in either locale

## Rationale

- Centralizing copy helps legal review and prevents accidental untranslated states.
- Typed catalogs fit the requirement to avoid scattering strings throughout components.
- Locale smoke tests are cheaper and more reliable when the catalog surface is explicit.

## Consequences

- New user-facing text must be added through the catalog workflow.
- Free-form legal copy should be reviewed per locale before publication.
- Product and legal review need a predictable export path for ES/EN message sets.
