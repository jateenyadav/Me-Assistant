# 06 — Roadmap (tick off live)

Owner requested on 2026-09-26 that implementation proceed across the whole
project rather than gating on one phase. Items are checked only after their
specific code and validation exist; a locally tested module is not a release.
Deployment, live credentials, store approvals, and teaching stay unchecked.

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
  - [x] Rolling 30-day user-scoped totals and category breakdown across all
    completed transactions; API tests, Atlas HTTP smoke and web build pass
  - [x] iOS Flutter runner + manual review-first email fallback; `flutter analyze`,
    widget test, simulator build and sign-in screen launch verified
  - [ ] Consented automatic email ingestion and cross-source duplicate reconciliation
  - [x] Indexed, 50-item cursor-paged history + 6-month UTC income/expense trend;
    finance tests, API/web typechecks, web build and Atlas HTTP smoke pass
- [ ] **Phase 2 — Diet** — USDA + Open Food Facts, food search + logging + barcode scan
  - [x] Server-side USDA search and Open Food Facts barcode **lookup**, manual/catalog
    food entries and 30-day macro/calorie rollup on web; API and Atlas tests
  - [ ] Live USDA/OFF credential checks, camera scanning, micros/recipes and daily analytics
- [ ] **Phase 3 — Workout** — wger/ExerciseDB integrated, workout builder, rest timers
  - [x] Live wger catalog endpoint checked; web set/rep/weight logging,
    straight/superset/circuit structure and rest timer; lifetime per-exercise
    heaviest logged weight/volume with API and Atlas ownership tests
  - [ ] Robust multi-exercise builder, dated PR/volume trends, mobile workout screens
- [ ] **Phase 4 — Medication, notes, reminders** — CRUD + notifications
  - [x] Owner-scoped API/web CRUD for medication schedules/intake, notes, and
    recurring reminder definitions; medication ownership tested over HTTP
  - [ ] OS delivery/scheduling, missed-dose workflow, audit-grade medication safety
- [ ] **Phase 5 — AI layer** — MCP server + core tools, built-in assistant reusing them, RAG for notes, BYOK settings, Bedrock default
  - [x] Shared tool execution, opt-in scoped/revocable MCP bearer tokens and HTTP
    endpoint; built-in read-only AI chat with consent and encrypted BYOK settings;
    unit and HTTP MCP tests
  - [ ] Notes vector RAG, production MCP OAuth/client interoperability,
    live provider tests/Bedrock credentials, prompt-injection evaluation
- [ ] **Phase 6 — Goals** — reads real data via the Phase 5 MCP tools to prioritize/track
  - [x] Web goal CRUD and deterministic owner-scoped progress for supported
    finance/diet/workout/medication units; unsupported goals clearly flagged
  - [ ] Cross-domain reasoning, scheduled daily priority recomputation
- [ ] **Phase 7 — Polish** — Redis caching, offline-first mobile sync, realtime alerts hardened
- [ ] **Phase 8 — Payments + scale pass** — Razorpay (Pro tier placeholder), scale walkthrough per module
- [ ] **Phase 9 — Hardening** — tests on money/medication, security pass on API-key storage + MCP auth, CI/CD
  - [x] Local money/medication/MCP/AI tests and Atlas HTTP isolation smoke;
    basic GitHub Actions build/typecheck/unit/Flutter workflow added
  - [ ] Workflow run on remote, key rotation, audit and security test, deploy pipeline
- [ ] **Phase 10 — Store submission** — privacy policy, permission declarations, listings (start early)
- [ ] **Phase 11 (stretch) — Desktop** — Electron wrapper around the web dashboard
