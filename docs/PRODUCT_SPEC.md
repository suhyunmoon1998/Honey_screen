# Product Specification — Honey Case Adventure

## 1. Product outcome

Honey Case Adventure helps a prospective legal client organize employment information in short daily sessions. The client should experience the flow as a respectful investigation with Honey rather than a long intake form.

Primary success metric for the MVP: a client can accept an invitation, verify identity, complete a 3–10 question mission, leave and resume safely, see Honey progress, upload evidence, request contact, and have staff review the activity.

## 2. Users

### Client

- Primarily Spanish-speaking California hourly workers
- Often using a mobile phone
- May be under stress, currently employed, or concerned about employer monitoring
- May have limited time, data bandwidth, or familiarity with legal terminology

### Staff

- Intake personnel reviewing client progress, evidence metadata, flags, and contact requests
- Needs a concise timeline and category summary, not raw database output

### Admin

- Manages staff, content publication, organization settings, notification providers, and audit review

## 3. Product principles

- Small daily commitment: 3, 5, or at most 10 substantive questions
- Respectful gamification: deterministic progress, no punishment or chance mechanics
- Trauma-informed pacing: avoid sequences of emotionally heavy questions
- Clear control: pause, resume, change language, change notification preferences
- Honest legal posture: issue spotting only, no legal conclusion or guarantee
- Privacy by default: minimal lock-screen text and no employer-sensitive data in notifications

## 4. Core client journey

1. Open a signed, expiring invitation link.
2. Read a short explanation and privacy warning.
3. Verify identity with OTP.
4. Record consent and notification preference.
5. Complete minimal onboarding.
6. Choose a 3-, 5-, or 10-question mission.
7. Answer one question per screen with autosave.
8. Pause and resume without losing saved answers.
9. Complete the mission and receive a deterministic Honey reward.
10. Optionally install the PWA, enable push, upload evidence, or request contact.
11. Return on another day without streak loss or guilt messaging.

## 5. Reliable event semantics

Do not equate a PWA “download” with a universally detectable event.

Track these separate events:

- `invitation_opened`
- `identity_verified`
- `registration_completed`
- `first_mission_started`
- `install_prompt_accepted` where supported
- `standalone_first_launch` when display mode proves a standalone launch
- `push_subscription_activated`
- `mission_completed`
- `evidence_uploaded`
- `contact_requested`

Staff notification rules should rely primarily on registration, mission, push-subscription, and standalone-launch events. UI may say “Honey was added to the home screen” only when the application has enough evidence to support that statement.

## 6. Mission behavior

### Mission sizes

- Quick: 3
- Standard: 5
- Full: 10 or remaining daily budget, whichever is lower

A client may extend today’s mission later, but the daily interaction total remains capped at 10.

### Substantive question definition

A screen is substantive when it asks for facts relevant to legal screening. The following do not count:

- language selection
- privacy acknowledgement
- consent
- contact preference
- install guidance
- notification permission explanation
- mission-complete screen

### Resume

A saved answer is available after refresh, logout, and another device login. An allocated question slot remains attached to its immutable question version. The server determines the next question.

## 7. Honey progression

Honey progression is derived from engagement events only:

- completed mission
- completed category
- clean evidence upload accepted
- onboarding completed
- contact preference completed

Suggested levels:

1. Nuevo compañero / New Friend
2. Buscador de pistas / Clue Finder
3. Detective del tiempo / Time Detective
4. Investigador del trabajo / Workplace Investigator
5. Ayudante de casos JACKLAW / JACKLAW Case Helper

Rewards are cosmetic or informational:

- magnifying glass
- time-clock clue
- lunchbox clue
- pay-envelope clue
- bandana
- investigator vest
- investigation-board item

No reward is random, purchasable, lost, or tied to legal merit.

## 8. Question content lifecycle

Each question has:

- stable key
- immutable version
- category
- ES and EN copy
- answer schema
- eligibility rule
- review-flag rule
- priority
- sensitivity level
- estimated effort
- legal review status: DRAFT, APPROVED, RETIRED
- publication timestamps

Only APPROVED versions are served in production. Seed content is DRAFT unless expressly reviewed by counsel.

## 9. Client-facing legal language

Permitted:

- “Hay información que el equipo legal debería revisar.”
- “Tus respuestas fueron guardadas.”
- “Enviar esta información no significa que JACKLAW haya aceptado tu asunto.”

Not permitted:

- “Tienes un caso.”
- “Te deben dinero.”
- “Vas a ganar.”
- percentages, case values, or settlement predictions

## 10. Notifications

### Client

Keep lock-screen content generic:

- “Honey preparó una misión corta para hoy.”
- “Tus respuestas siguen guardadas.”
- “JACKLAW tiene una actualización para ti.”

Do not put employer names, issue categories, or evidence details in push or SMS.

### Staff

Meaningful events only:

- client registered
- first mission started
- mission completed
- push activated
- standalone first launch
- evidence clean and available
- contact requested
- urgent review flag created

Use deduplication and configurable batching to avoid alert fatigue.

## 11. Staff experience

Dashboard filters:

- new
- urgent
- inactive
- contact requested
- evidence available
- Spanish / English
- current / former employee
- assigned staff member

Client detail:

- identity and contact preferences
- employer summary
- answer timeline by category
- exact question version and answer timestamp
- review flags
- evidence status
- Honey progress
- staff notes
- audit history
- printable intake summary

Staff notes never appear to clients.

## 12. Evidence

Allowed MVP types should be explicitly configured. Recommended initial set:

- PDF
- JPEG
- PNG
- HEIC/HEIF when the runtime can safely identify it

Files first enter quarantine. The UI may show “processing” but must not offer staff download until clean. Original filename is metadata only and is never part of the storage key.

## 13. Accessibility and language

- WCAG 2.2 AA target for primary flows
- large touch targets
- visible focus
- semantic headings and form labels
- screen-reader announcements for save status
- reduced-motion mode
- locale-specific date and number formatting
- plain Spanish reviewed for worker comprehension

## 14. Explicit non-goals for MVP

- native iOS or Android applications
- AI-generated legal conclusions
- chat bot giving legal advice
- full law-firm case management
- automated document OCR or evidence interpretation
- client-to-attorney real-time chat
- payment or retainer execution
- multi-jurisdiction legal rule engine
