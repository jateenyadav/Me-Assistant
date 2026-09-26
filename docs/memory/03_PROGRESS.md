# 03 — Progress (rewritten every session)

_Last updated: 2026-09-26 (cross-phase integrated build)_

## Current state
**Cross-phase implementation, not a completed product or store release.** Owner
requested completing the whole project without one-phase-at-a-time gating.
Independent modules can move forward while external accounts and device checks
remain open. No automatic commit/push of this multi-module working tree.

## Shipped locally
- Existing NestJS/Next.js/shared monorepo, JWT/Google OIDC auth, exact-paise
  finance dashboard, summary, cursor history, trends, Android forward-only
  payment listener and review-first manual email import remain intact.
- Added owner-scoped, strict validated CRUD for food, workouts, medication
  schedules and taken/skipped intakes, notes, recurring reminder definitions
  and short/long goals, plus web forms and editable profile metrics.
- Added catalog-backed USDA food search, Open Food Facts barcode text lookup
  and cached wger exercise search. Missing nutrients remain unknown, not zero.
  Web workout logging accepts sets/reps/weight, structures and a rest timer;
  diet displays an owner-scoped rolling 30-day macro/calorie summary; workouts
  display bounded lifetime per-exercise set/weight/volume stats.
- Added deterministic goal progress from real owner activity for supported
  units: INR net flow, kcal, workout sessions and taken medication doses.
- Added optional scoped MCP Streamable HTTP endpoint with hashed, expiring,
  revocable tokens, separate from web JWT; built-in AI chat reuses owner-scoped
  data tools, explicit request consent, Bedrock/configured BYOK providers,
  AES-256-GCM saved-key encryption and provider failure isolation.
- Created the Flutter iOS runner and guarded Android-only channel calls. Added
  an iOS/Android mobile payment-email preview and explicit time/category import.
  iOS debug uses simulator localhost; release app enforces HTTPS API base URL.
- Added basic GitHub Actions CI for backend/web builds, typechecks, focused
  API tests and Flutter analysis/widget tests; no remote run yet.

## Actually verified
- API and web production builds/typechecks pass; 36 focused Google/finance/
  catalog/life/AI/MCP tests pass. Atlas HTTP smoke passes including user
  isolation, medication ownership, finance and scoped MCP token revocation;
  synthetic smoke users and records are removed after the run.
- Flutter analysis and widget test pass; iOS simulator build passes and the
  iPhone 17 Pro simulator launched the unsigned debug sign-in screen (visually
  inspected). Prior Android APK/JUnit and finance smoke passed; this session
  did not revalidate physical payment notifications.
- Live wger pagination was checked; **USDA/OFF nutrition, BYOK/Bedrock model
  calls, Google sign-in consent and signed-in mobile iOS flow were not**.
- API lint cannot run: existing `eslint` script has no installed `eslint`
  executable. Don't count lint as passing or hide this gap.
- CI workflow is unverified until pushed/run on GitHub; it does not build iOS
  on macOS or run a live Atlas HTTP smoke in CI.

## Mid-flight / required next work
- Finance: consented mailbox OAuth, verified sender/ingestion, cross-source
  reconciliation, real Android payment-app tests, mobile outbox resilience.
- Diet/workout: real credentials, camera barcode scanning, recipes, micronutrients,
  daily nutrition analytics, complete workout builder/dated PR trends; mobile
  diet/workout screens are absent.
- Medication/reminders: reliable OS notifications, timezone recurrence engine,
  missed-dose handling and user-device delivery; notes need real vector RAG.
- AI/MCP/goals: owner provider credentials/live evaluations, token rate limits,
  OAuth discovery for broad MCP clients, key rotation, scheduled daily goal
  reasoning, prompt-injection/cost/medical-safety evaluations.
- Product/ops: durable mobile session and offline sync/conflict handling,
  Redis/queues, observability, Razorpay subscriptions/webhooks, security
  hardening, CI/CD, privacy/store assets, release signing, real production
  deployment and verification. These cannot be marked complete from local tests.

## External blockers
- Hosting/secrets and app-store developer accounts, billing configuration,
  Google OAuth credentials, USDA key, provider keys/Bedrock access, and user
  mailbox consent are owner-dependent. Physical Android device/payment apps
  and production device QA are also needed. No outside services are connected
  without explicit account provisioning and permission.
- Learning walkthrough, diagram/file maps, alternative/scaling/interview
  teach-backs remain pending per owner's development-first preference; new
  concepts are logged in `04_LEARNING_LOG.md` and not marked taught.

---
## Resume bullets (draft; revise after production verification)
- Built a tenant-isolated TypeScript monorepo across NestJS, Next.js, Flutter
  and shared Zod contracts, with exact-paise finance and user-scoped analytics.
- Implemented Android opt-in forward-only payment capture, idempotent import
  and iOS manual email review; validated API cross-user boundaries and an iOS
  simulator build/launch, not real-store or physical-device behavior.
- Delivered typed activity/health/goal APIs and web flows, external food and
  exercise catalog adapters, and measured cross-module goal progress.
- Added scoped revocable MCP tools and an opt-in AI assistant with encrypted
  BYOK credentials, reusing user-scoped tool execution; provider calls and
  full notes RAG are not yet verified or built respectively.
