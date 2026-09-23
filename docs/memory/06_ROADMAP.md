# 06 — Roadmap (tick off live)

Don't start a phase until the previous one is committed and this file reflects it.

- [ ] **Phase 0 — Foundation** _(in progress)_
  - [x] Repo + persistent-context memory system live
  - [x] Monorepo scaffold (pnpm + Turborepo): api / web / shared
  - [x] NestJS foundation: config, Mongoose, `/health`, `User` model
  - [x] JWT auth end-to-end (register/login/refresh/logout/me), rotation + hashed at rest
  - [x] Next.js web: login/register + guarded dashboard
  - [x] Auth round-trip verified against a live `MONGODB_URI` (HTTP smoke test with cleanup)
  - [ ] Owner walkthrough/teach-back: HTTP API, request flow, DB connection, auth/JWT,
    alternatives, scaling, and interview questions (HTTP validation lesson delivered;
    teach-back and DB/JWT lessons still pending)
  - [ ] Empty app deployed (web + API) — _deferred until accounts/secrets ready_
- [ ] **Phase 1 — Finance** — Android notification listener + email fallback + categorization flow; dashboard built fresh
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
