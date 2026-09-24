# 06 — Roadmap (tick off live)

Normally complete and commit a phase before starting the next. Owner explicitly
requested development-first on 2026-09-23: finance groundwork may proceed while
Phase 0 deployment and Google live consent remain open. Do not mark Phase 0
complete or the teaching checkpoint checked until they actually happen.

- [ ] **Phase 0 — Foundation** _(in progress)_
  - [x] Repo + persistent-context memory system live
  - [x] Monorepo scaffold (pnpm + Turborepo): api / web / shared
  - [x] NestJS foundation: config, Mongoose, `/health`, `User` model
  - [x] JWT auth end-to-end (register/login/refresh/logout/me), rotation + hashed at rest
  - [x] Next.js web: login/register + guarded dashboard
  - [x] Auth round-trip verified against a live `MONGODB_URI` (HTTP smoke test with cleanup)
  - [x] Optional Google OIDC sign-in (web/API flow, state + PKCE + nonce, one-use
    MongoDB handoff; focused tests and existing auth smoke pass)
  - [ ] Google live consent verified with owner-provided OAuth client credentials
  - [ ] Owner walkthrough/teach-back: HTTP API, request flow, DB connection, auth/JWT,
    Google sign-in, alternatives, scaling, and interview questions (owner answered
    server rejects invalid input; DB/JWT/OIDC teach-back still pending)
  - [ ] Empty app deployed (web + API) — _deferred until accounts/secrets ready_
- [ ] **Phase 1 — Finance** _(in progress)_ — Android notification listener + email fallback + categorization flow
  - [x] Manual INR transaction entry and recent-history dashboard; authenticated,
    user-scoped API, shared validation and money/isolation tests
  - [x] Android forward-only listener, on-device parser/queue, explicit capture opt-in,
    category review, authenticated idempotent imports + learned UPI matching;
    API tests, Atlas HTTP smoke and debug APK build pass
  - [x] Version native Gradle wrapper and validate parser JUnit tests from a
    reproducible checkout; validate Flutter analysis/widget tests and APK
  - [ ] Verify Android notification access and real payment-app messages on a device;
    calibrate parser and confirm store/privacy disclosures before release
  - [x] Manual email paste + review flow on web (usable from an iOS browser):
    conservative API preview, user-confirmed category/time, private idempotent import;
    parser/unit/Atlas HTTP smoke coverage
  - [x] Push validated finance/mobile slice to confirmed `Me-Assistant` origin
  - [ ] Email ingestion and duplicate handling; iOS fallback
  - [ ] Finance trends, paging and broader dashboard
- [ ] **Phase 2 — Diet** — USDA + Open Food Facts, food search + logging + barcode scan
- [ ] **Phase 3 — Workout** — wger/ExerciseDB integrated, workout builder, rest timers
- [ ] **Phase 4 — Medication, notes, reminders** — CRUD + notifications
- [ ] **Phase 5 — AI layer** — MCP server + core tools, built-in assistant reusing them, RAG for notes, BYOK settings, Bedrock default
- [ ] **Phase 6 — Goals** — reads real data via the Phase 5 MCP tools to prioritize/track
- [ ] **Phase 7 — Polish** — Redis caching, offline-first mobile sync, realtime alerts hardened
- [ ] **Phase 8 — Payments + scale pass** — Razorpay (Pro tier placeholder), scale walkthrough per module
- [ ] **Phase 9 — Hardening** — tests on money/medication, security pass on API-key storage + MCP auth, CI/CD
- [ ] **Phase 10 — Store submission** — privacy policy, permission declarations, listings (start early)
- [ ] **Phase 11 (stretch) — Desktop** — Electron wrapper around the web dashboard
