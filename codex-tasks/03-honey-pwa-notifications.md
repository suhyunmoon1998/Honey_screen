# Codex Task 03 — Honey Experience, PWA, and Notifications

## Goal

Make the client experience feel like a respectful Honey investigation adventure, add installable PWA behavior, and create honest, retryable notification infrastructure.

## Required scope

### Honey experience

- five progression levels from the product spec
- append-only progress events and idempotent reward grants
- investigation board/room that gains deterministic items
- Honey states: neutral, investigating, resting, mission complete
- use the supplied image with framing and CSS treatment; do not invent a different dog
- no negative inactivity state
- return copy that welcomes the client without guilt
- reduced-motion support

### PWA

- valid manifest and icons derived from approved Honey/brand assets
- standalone display mode
- static offline shell only
- explicit `no-store` on sensitive responses
- no authenticated content in Cache Storage
- install UI shown only when supported or when platform-specific instructions are valid
- record prompt acceptance separately from standalone first launch
- device installation record without fingerprinting
- install guidance after engagement, not on the first screen

### Notifications

- in-app notification center
- Web Push provider interface with development adapter
- SMS/email provider interfaces with console or local-mail adapters
- VAPID/push subscription storage where supported
- notification consent and preference changes
- quiet hours and locale-aware scheduling
- generic privacy-preserving templates
- staff notifications for registration, first mission, completion, push activation, standalone launch, contact request, and urgent review flag
- transactional outbox retries, deduplication, dead-letter state
- never report stub delivery as real delivery

## Required tests

- progression idempotency and no decay
- no legal-strength dependency
- manifest/install smoke test
- unsupported-browser install fallback
- standalone first-launch idempotency
- service-worker sensitive-cache regression test
- notification deduplication, retry, revocation, quiet hours
- lock-screen template redaction
- accessibility and reduced motion

## Done when

A supported browser can install and launch the PWA, the staff UI uses precise event language, no sensitive response is cached, and notification behavior is truthful and testable with development adapters.
