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
