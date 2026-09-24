# 03 — Progress (rewritten every session)

_Last updated: 2026-09-24 (30-day finance summary and live local smoke)_

## Current phase
**Phase 1 — Finance groundwork** (in progress by owner request; Phase 0 deployment,
Google live consent, and teaching checkpoints remain open)

## Done
- Bootstrapped persistent-context system: `AGENTS.md`, `CLAUDE.md`, `/docs/memory/` (8 files), root README.
- Monorepo scaffold (pnpm 12.5.1 + Turborepo 2.11.2): `apps/api`, `apps/web`, `apps/mobile`, `packages/shared`.
- `@lifeos/shared`: Zod auth DTOs + shared types — builds to `dist`.
- NestJS API: env validation (Zod, fail-fast), Mongoose async connection, `GET /health` (DB ping), `User` model (RBAC role, profile), toPublicUser mapper. **Builds** (`dist/main.js`).
- JWT auth end-to-end: register/login/refresh/logout/`me`. Access = JWT; refresh = opaque `jti.secret`, bcrypt-hashed at rest, rotated on use, reuse-detection revokes chain, TTL index auto-purges. Typechecks.
- Next.js (App Router) web: login/register (shared-schema validation) + guarded `/dashboard` with silent-refresh. **Production build passes** (5 routes).
- Atlas connection pinged; hardened refresh and logout token verification, added atomic
  refresh claim and web single-flight refresh.
- Live HTTP auth smoke passed: health, register, me, login, refresh, forged-token
  rejection, replay revocation, logout. Test user and tokens were cleaned up.
- API and web typechecks and API build pass.
- Started web dev server on localhost:3000 for hands-on testing; existing NestJS watch
  process serves API on localhost:4000. Verified login page HTTP 200, health HTTP 200
  with database up, and auth CORS preflight HTTP 204. Runtime servers are ephemeral.
- Taught the registration request path in chat: web form and shared Zod schema → HTTP
  POST → NestJS controller and server-side validation → service → MongoDB → safe
  response. Included a non-mutating invalid-payload `curl` check, alternatives,
  scaling considerations, and interview Q&A; owner teach-back is still pending.
- Google OAuth 2.0 / OIDC web sign-in integrated with the existing LifeOS auth:
  authorization code, PKCE, state cookie + DB attempt, nonce and verified ID
  token, Google `sub` user lookup, hashed one-use ticket, and standard session
  tokens. Existing password flow remains intact; existing email is not linked.
- Google focused tests (state, PKCE, verified identity, expiry, replay) and API/web
  typechecks pass; web production build passes with the new callback route.
  Existing auth smoke passes against configured Atlas with Google input checks;
  uniquely named test user/tokens were cleaned up.
- Owner answered the simple validation checkpoint correctly: the server rejects
  the short password. Google sign-in path, alternatives, scale, and interview
  question were presented in chat; owner OIDC teach-back remains pending.
- Dedicated database walkthrough prepared for the owner: request → API validation →
  UsersService/Mongoose → MongoDB → safe JSON response, plus connection/health
  checks, alternatives, scale, and interview Q&A. Owner DB teach-back pending.
- Manual finance vertical slice: integer-paise INR validation shared by API/web,
  guarded transaction create/list endpoints with server-owned userId and a user/time
  index, and a dashboard entry form with a 50-record recent history.
- Finance unit tests (paise parsing, invalid DTOs, user ownership) and live HTTP
  Atlas smoke (auth, invalid money, unauthorized writes and second-user isolation)
  pass; smoke cleaned up both test users and their records. Google tests, API/web
  typechecks, API and web production builds pass.
- Bootstrapped Android Flutter shell with explicit app-level capture opt-in and
  system permission handoff. Native `NotificationListenerService` accepts only NEW
  posts from known payment apps; conservative parser excludes OTP/failed/requested
  messages, stores parsed-only candidates privately (backup off), and raises a
  generic open-the-app alert. It never scans existing notifications.
- Flutter foreground sync retries parsed events after login; 401 refresh works while
  app is alive. Unmatched imports surface a category picker; categorizing saves
  a per-user/type HMAC UPI mapping so future events from that counterparty auto-file.
  Logout stops listener capture and clears its local queue.
- Authenticated API notification import uses a partial unique per-user/event index
  and atomic upsert; replay returns the existing record, changed-payload replay
  returns 409, and pending records do not pollute completed history. Added DTO,
  idempotency, learned-mapping, and ownership tests plus live HTTP Atlas smoke;
  smoke cleans up test users, transactions, and mappings.
- `flutter analyze`, `flutter test`, native Kotlin parser JUnit tests,
  `flutter build apk --debug`, API typecheck/build, finance and Google tests,
  and live HTTP smoke pass. Android capture itself has
  **not** been exercised on a real device; debug APK compilation is not that check.
- Added authenticated paste-and-review email payment import on the web (usable
  from an iOS browser): conservative INR confirmation parser, explicit category
  and payment time, server-side reparse, structured-only persistence, and
  user/source-scoped HMAC replay protection. A nearby-amount warning asks the
  user to check history; it does not silently merge distinct payments.
- Email parser/unit tests cover unpaid/failed/ambiguous messages, repeated generic
  receipts, replay and ownership. Atlas HTTP smoke covers preview authorization,
  malformed input, replay/concurrent retries and user isolation. API/web
  typechecks and web production build pass.
- Revalidated the combined finance/mobile batch: 8 finance and 8 Google unit tests,
  API/web typechecks, web production build, live Atlas HTTP smoke with cleanup,
  Flutter analysis/widget test/debug APK, and Android parser JUnit task all pass.
  Gradle wrapper launcher/JAR are now included for fresh-clone native testing.
- Owner requested finish-and-validate one slice before moving on and push completed
  code periodically. The finance/mobile batch was pushed to `Me-Assistant` as
  `0447f1e` (main), following the owner's explicit destination confirmation.
- Added a user-scoped rolling 30-day finance summary on the dashboard: expense,
  income, and expenses by category across the full window rather than the
  recent-50 list. MongoDB Decimal128 aggregation excludes pending/future records
  and guards JSON safe-integer limits; API, shared DTO and dashboard use one
  contract. Finance unit tests (9), Google tests (8), root workspace tests/build,
  API/web typechecks, Atlas HTTP auth/isolation smoke, Flutter analysis/widget
  test, native Android parser test and debug APK build all pass.
- Ran the built API and web dashboard on localhost:4000/3000 and confirmed health
  DB=up, login HTTP 200 and unauthenticated summary HTTP 401. Launched the
  Flutter Android debug app on an Android emulator and visually confirmed its
  sign-in screen; no payment-app notification or signed-in mobile flow was tested.

## In progress
- Live deployment still requires owner-provisioned hosting accounts and secrets.
- Owner authorized development-first despite incomplete deployment. `origin`
  (`jateenyadav/Me-Assistant`) is the confirmed push target; keep future pushes
  to completed, validated slices only.
- Learning walkthrough and teach-backs are deferred until the end at owner's
  request; Phase 0 teaching stays unchecked. Finance concepts logged as pending.
- Google live consent/callback still needs owner-created Web OAuth credentials.
- Android device listener permission flow and real vendor notifications require a
  phone/emulator with supported payment apps; parse precision and release/privacy
  review cannot be inferred from the APK build.
- Email path currently requires manually pasted content and explicit confirmation;
  no sender verification, connected mailbox, iOS native share path or automatic
  Android/email cross-source reconciliation exists yet.
- Built API and web server processes plus Flutter Android emulator were started
  for this session; their longevity after the CLI exits is not guaranteed.
- The project is **not complete**: Phase 1 still needs email ingestion,
  reconciliation, paging and device validation; Phases 2–10, iOS shell,
  deployment and store release are open. Do not equate local smoke with release.

## Next
- Connect a consented mailbox for automatic iOS email ingestion (with secure tokens,
  cursors and provider compliance); add reliable cross-source reference matching or
  explicit user-driven reconciliation before claiming duplicate-free finance data.
- Validate real Android notifications and consent on a device; harden the mobile
  outbox and iOS native flow after that.
- Add indexed history paging and longer-term trends; then continue the remaining
  modules as validated slices, pushing each completed batch to `Me-Assistant`.
- Owner configures Google OAuth credentials to test real consent/callback and
  provisions hosting to deploy API + web.
- Revisit the pending DB/JWT/OIDC/finance lessons at the end, with hands-on
  checks and teach-backs before checking the roadmap teaching item.

## Blockers
- Deployment needs hosting accounts/secrets; live Google sign-in needs owner-created
  Google Web OAuth client ID/secret and registered callback URL. Physical-device
  validation needs supported payment apps. Automatic mailbox sync also needs owner
  consent and provider credentials; none blocks local design and parser work.
- No iOS Flutter project currently exists (`apps/mobile/ios` is absent), so the
  iOS app cannot be launched even though an iOS Simulator is installed.

---
## Resume bullets
_(Draft 1–2 per completed phase; refine with real numbers.)_
- Architected a TypeScript monorepo (pnpm + Turborepo) for LifeOS spanning a NestJS API,
  Next.js dashboard, and shared type package with Zod-validated DTOs shared across services.
- Built JWT auth with hashed rotating refresh tokens, verified over HTTP against Atlas;
  prevented unauthenticated token revocation and concurrent double-claims.
- Extended custom JWT authentication with Google OIDC sign-in using PKCE,
  nonce/ID-token verification, replay-safe DB handoff, and the existing session
  model; tested failure/replay paths without persisting Google provider tokens.
- Built a user-isolated finance entry and recent-history flow, storing INR amounts
  as exact paise; verified validation and cross-account isolation over live HTTP.
- Built an opt-in Android payment notification capture path with on-device parsing,
  replay-safe user-scoped imports and learned UPI categorization; validated with
  unit tests, an Atlas HTTP smoke and a compiled debug APK.
- Added a review-first payment-email import with conservative INR parsing and
  atomic per-account idempotency; tested replay and cross-account isolation over HTTP.
- Added a rolling 30-day, user-scoped finance breakdown using exact Decimal128
  aggregation instead of truncating totals to displayed records; verified API
  ownership and live HTTP behavior against Atlas.
