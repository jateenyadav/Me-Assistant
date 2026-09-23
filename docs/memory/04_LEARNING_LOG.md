# 04 — Learning Log (append-only)

The interview-prep artifact. Short entries, tagged to a commit/feature. Don't re-teach a
logged concept — reference it and note only what's new.

---

## 2026-09-20 — JWT access + refresh tokens (rotation + hashed at rest)
**Where:** auth service, Phase 0 (`apps/api/src/auth`).

**What:** A short-lived **access token** (~15 min, stateless JWT, sent on every request)
plus a longer-lived **refresh token** (~7–30 days). The access token proves who you are;
the refresh token buys a new access token when it expires. On each refresh we **rotate**:
issue a new refresh token and invalidate the old one. Refresh tokens are stored **hashed**
(bcrypt) in Mongo, never in plaintext — so a DB leak doesn't hand over usable tokens.

**Why here:** A mobile + web client can't sit behind server sessions comfortably, and we
don't want to force re-login every 15 minutes. Short access token = small blast radius if
stolen; refresh token = smooth UX. Rotation + hashing lets us **detect reuse** (an old
refresh token showing up after rotation ⇒ likely theft ⇒ revoke the whole chain).

**Alternatives considered:**
- *Server-side session cookies* — simplest, easy revocation, but stateful and awkward for a
  native mobile client without extra plumbing.
- *Firebase Auth* — fastest to ship, but hides the mechanism (the whole point here is to learn it).
- *Long-lived access token only* — no refresh complexity, but a stolen token is valid for
  its full (long) lifetime with no cheap revocation.

**At scale (100k users):** the refresh-token store becomes a write/read hot path — needs a
dedicated index (by userId + tokenHash), TTL cleanup of expired rows, and eventually a
Redis-backed store instead of Mongo. Access-token verification stays cheap (stateless, just
signature check) — that's the payoff of statelessness.

**Interview angle:** "How do you handle token expiry without logging users out constantly?"
· "How would you revoke a stolen token?" (rotation + reuse detection) · "Why hash refresh
tokens if they're already random?" (defense in depth against DB compromise).

**Implementation note:** refresh tokens here are **opaque** (`jti.secret`), not JWTs. Why:
bcrypt silently truncates input past 72 bytes, and a signed JWT is longer than that, so
hashing a JWT would only protect its first 72 bytes. Hashing a 64-char random secret is
both correct and simpler. The `jti` gives us O(1) lookup; the `secret` is what we bcrypt.

---

## 2026-09-20 — Client-side token storage (web)
**Where:** `apps/web/src/lib/auth.ts`, Phase 0.

**What:** Access token kept in a module-level variable (memory only); refresh token in
`localStorage` so a page reload can silently re-auth via `/auth/refresh`.

**Why here / trade-off:** memory-only access token dies on reload but is never exposed to
persistent XSS-readable storage. The refresh token in `localStorage` **is** readable by any
XSS on the page — acceptable for an MVP, but the production hardening is to have the API set
the refresh token as an **httpOnly, SameSite=strict, Secure cookie** so JS can't read it at
all (trades off needing CSRF protection instead). Deferred to Phase 7/9.

**At scale:** unchanged per-user; the security posture is what matters, not throughput.

**Interview angle:** "Where do you store JWTs on the client and why?" (memory vs
localStorage vs httpOnly cookie; XSS vs CSRF trade-off).

---

## 2026-09-22 — Atomic token claim and authenticated revocation (Phase 0 auth smoke)
**Where:** `apps/api/src/auth/auth.service.ts`, `apps/web/src/lib/auth.ts`,
`apps/api/scripts/auth-smoke.cjs`.

**What / why here:** Knowing a token's public lookup ID (`jti`) does not prove possession
of the secret. Check the bcrypt hash before replay detection or logout can revoke any
session. Then use a conditional MongoDB update (`revoked: false`, not expired) to claim
one token atomically: two requests cannot both win that *single-document* claim. Share
the browser's concurrent refresh attempts so a single tab doesn't race itself.

**Alternatives:** Read → modify → save is simplest but both requests can read the same
unrevoked token. A database transaction can cover multiple documents but increases
latency/operational burden. Distributed locking can serialize refreshes across servers
but adds lock failure modes and a Redis dependency.

**At 100k users:** Indexes on token ID and expiry keep lookup/cleanup bounded; monitor
refresh contention and replay alerts. A single-document claim does *not* atomically
cover issuing the new token or revoking all sessions. If concurrent theft handling must
have a strict all-or-nothing guarantee, introduce a transaction or a per-user session
generation checked during issuance. Browser single-flight only coordinates one tab;
it doesn't coordinate devices or browser tabs.

**Interview angle:** "Why isn't checking `revoked` then calling `save()` safe under
concurrency?" and "Which part of rotation does MongoDB guarantee is atomic?"

---

## 2026-09-23 — Beginner walkthrough initiated: HTTP API → database → JWT (Phase 0)
**Where:** `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/auth.service.ts`,
`apps/api/src/app.module.ts`, `apps/api/src/health/health.controller.ts`.

**What / why:** Trace an actual register request from the web form to an HTTP POST,
NestJS controller, shared Zod validation, auth service, Mongoose User collection,
and JSON response. Explain an API as a contract between browser and server; a database
as durable storage connected by a URI kept in `.env`; and access/refresh tokens as
short/long-lived login credentials. Taught directly in chat; understanding not yet
confirmed. Do not mark the Phase 0 teach-back complete until the owner verifies it.

**Alternatives / 100k users / interview:** REST vs GraphQL vs RPC; MongoDB vs SQL vs
Firebase; JWT + rotating refresh vs server sessions vs managed auth. Add indexes,
rate limits and pool/connection budgeting before high traffic. Interview prompt:
"Trace `POST /auth/register` from request to response and explain where state lives."

---

## 2026-09-23 — Request-boundary validation lesson delivered (Phase 0 teaching)
**Where:** `apps/web/src/components/AuthForm.tsx`, `apps/web/src/lib/auth.ts`,
`packages/shared/src/auth.ts`, `apps/api/src/auth/auth.controller.ts`,
`apps/api/src/common/zod-validation.pipe.ts`, `apps/api/src/auth/auth.service.ts`.

**What / why here:** Walked through a LifeOS sign-up from browser form to HTTP POST,
server-side Zod validation, service, MongoDB, and safe JSON response. Client validation
provides fast feedback; server validation is the trust boundary because clients can
bypass the form. A direct `curl` POST with a short password should produce HTTP 400
without creating an account. This was presented in chat; owner teach-back is pending.

**Alternatives:** REST has simple inspectable endpoints; GraphQL offers selected
fields with query/schema complexity; RPC offers ergonomic typed calls but less direct
resource inspection. Client-only validation is insufficient for untrusted callers.

**At 100k users:** Keep server validation, then add rate limits on registration,
monitor errors, and budget database connections rather than assuming validation
alone protects the endpoint.

**Interview angle:** "Why validate on both client and server?" Client checks improve
UX; server checks enforce the contract for any caller. Next checkpoint: have the
owner explain why a direct short-password request receives 400 before a DB write.

---

## 2026-09-23 — Google OAuth 2.0 / OpenID Connect sign-in (Phase 0 extension)
**Where:** `apps/web/src/components/AuthForm.tsx`, `apps/web/src/lib/auth.ts`,
`apps/web/src/app/auth/google/complete/page.tsx`, `apps/api/src/auth/google-auth.controller.ts`,
`apps/api/src/auth/google-auth.service.ts`, `apps/api/src/auth/schemas/google-auth-attempt.schema.ts`.

**What / why here:** Google checks identity; LifeOS controls its own accounts and
sessions. Taught in chat: button → API redirect → Google → API callback exchanges
the code with PKCE and verifies Google's ID token including audience, nonce, and
verified email → service finds/creates a Google-subject user in MongoDB → short,
hashed one-use ticket returns in a URL fragment → browser checks saved state,
POSTs the ticket → API consumes it and issues existing LifeOS tokens. A safe
hands-on check is to configure owner credentials, sign in twice with the same
Google account, and verify both visits return to the same LifeOS dashboard.
The owner answered the earlier request-validation check correctly ("reject it");
the broader DB/JWT/OIDC teach-back has not happened yet.

**Alternatives:** Browser ID-token sign-in with API verification needs fewer
redirects but is not the requested server-side code flow; shared-site HttpOnly
session cookies reduce JS token exposure but demand coordinated domains and
CSRF protection; email-based auto-linking is convenient but unsafe without
explicit proof of ownership.

**At 100k users:** TTL indexes and atomic consumption keep ephemeral records
bounded and reject replay across API replicas. Add rate limits, observability
for sign-in failures, DB connection budgeting, and secret rotation.

**Interview angle:** "Why doesn't the Google code itself log a user into LifeOS?"
Only after code exchange, signed ID-token and nonce verification, and mapping
Google `sub` to a LifeOS user does LifeOS issue its own session. OIDC teach-back
is still pending.

---

## 2026-09-23 — MongoDB connection and persistence walkthrough (Phase 0 teaching)
**Where:** `apps/api/src/app.module.ts`, `apps/api/src/config/env.validation.ts`,
`apps/api/src/users/users.service.ts`, `apps/api/src/users/schemas/user.schema.ts`,
`apps/api/src/health/health.controller.ts`.

**What / why here:** The browser sends `POST /auth/register`; server-side Zod
validation precedes `AuthService.register`, which looks up the email and passes a
password hash to `UsersService.create`. Mongoose persists the User document in
MongoDB using the API's `MONGODB_URI`; `toPublicUser` omits `passwordHash` from the
response. The API keeps the URI private and checks it at startup. `/health` pings
the database when the API is running, without creating a user or exposing secrets.
This dedicated explanation is presented in chat; owner teach-back is pending.

**Alternatives:** PostgreSQL gives relational constraints and strong transactions
but requires a different schema/query model; Firebase reduces operational setup
but trades away backend control and some learning value; in-memory storage is
simple for a demo but disappears on restart and cannot serve multiple API replicas.

**At 100k users:** Budget connection pools across API replicas, verify indexes
on email and common queries, monitor query latency and failures, and avoid a
database connection per HTTP request.

**Interview angle:** "Where does a registration survive a browser refresh, and
what does `/health` prove?" The server writes the user into MongoDB; the health
check proves the running API can currently ping its DB, not that every query or
future request will succeed. Next checkpoint: owner explains both in their own words.

---

## 2026-09-23 — Pending lesson: finance money and tenant isolation (Phase 1)
**Status:** not taught; owner asked to do learning at the end. Do not check off
teach-back from this entry.

**Where:** `packages/shared/src/finance.ts`, `apps/api/src/transactions`,
`apps/web/src/components/FinancePanel.tsx`.

**Teach later:** Trace rupee text → exact integer paise → strict shared Zod DTO →
authenticated controller deriving `userId` → Mongoose write → safe response and
per-user recent-history query. Discuss float vs integer paise vs Decimal128;
at 100k users cover indexes, cursor pagination, reconciliation/idempotent imports,
and DB connection budgeting. Interview prompt: "How would you prevent one user
from reading or forging another user's transactions, and why avoid floating-point
storage for money?" Add hands-on check and owner teach-back when lessons resume.
