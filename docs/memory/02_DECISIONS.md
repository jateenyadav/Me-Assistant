# 02 — Decision Log (append-only)

Format: date · decision · alternatives considered · why.

## 2026-09-20 — App name: LifeOS
Chosen over "Nexus" and "Corely". npm scope `@lifeos/*`. Why: literal, describes the
all-in-one personal-life scope; unambiguous for the user.

## 2026-09-20 — Web framework: Next.js (App Router), not React + Vite
Alternatives: React + Vite (brief's default — fastest, pure SPA, but no SSR surface).
Why: the brief explicitly flags this as a decide-before-Phase-0 call; Next.js adds SSR,
App Router, and server components — genuinely more interview value. Cost: slightly more to
manage on top of the NestJS API. Accepted.

## 2026-09-20 — Monorepo with pnpm + Turborepo
Alternatives: npm workspaces (simpler, no Turbo learning curve, slower at scale);
separate repos (simplest per-repo but duplicates shared types + the memory system).
Why: one repo matches "this repo is LifeOS"; shared TS types across web+API in
`packages/shared`; Turbo gives task caching + a real monorepo pattern to learn.

## 2026-09-20 — Backend: NestJS; DB: MongoDB Atlas/Mongoose
Per brief defaults. NestJS for DI/guards/interceptors (interview patterns) over bare
Express (faster but teaches less). Mongo for flexible schema + existing familiarity.

## 2026-09-20 — Session 0 scope: memory system + scaffold + auth; deploy deferred
Why: live deployment needs the user's Atlas/Render/Vercel accounts + secrets, not yet
provisioned. Build + verify auth locally first; wire deploy once accounts exist.

## 2026-09-20 — Toolchain note (not a design decision)
Homebrew Node v25.9.0 ships without corepack, so pnpm was installed globally via
`npm i -g pnpm` (v12.5.1) rather than corepack. Revisit if switching to nvm/Volta.

## 2026-09-22 — Phase 0 auth verification: atomic refresh claim + live smoke test
Require the token secret before replay response or logout revocation; claim a refresh
token with a conditional single-document MongoDB update before issuing a replacement.
The web client shares in-flight refresh requests to avoid accidental replay from two
simultaneous 401 responses. Alternatives: read-then-save (lost-update race); MongoDB
transaction around rotation (stronger multi-document guarantee but heavier); serialize
all refreshes in a distributed lock (operational complexity). The conditional claim
keeps the current slice small. The smoke test uses the configured live database and
cleans up only its uniquely named test user's records; it does not require another
database, an in-memory MongoDB emulator, or additional packages.

## 2026-09-23 — Google OIDC code flow as optional web sign-in
Use authorization code + PKCE + OIDC nonce through the official
`google-auth-library` 11.1.0 on NestJS, which raises the required Node version
to 22. A short-lived HttpOnly SameSite=Lax state cookie and an atomically
consumed, TTL-indexed MongoDB attempt bind the callback to this browser. Verify
Google's signed ID token/audience/nonce and verified email, then identify the
LifeOS account by Google's stable `sub`. No Google provider tokens are stored.
A hashed, one-use, 60-second DB ticket returned in the URL fragment lets web and
API deploy on different sites without exposing LifeOS tokens in query strings;
the browser checks its own `sessionStorage` state before exchanging the ticket.

Alternatives: Google's browser ID-token button is simpler but does not use the
requested API-side code exchange; a shared-site HttpOnly refresh cookie reduces
XSS exposure but needs coordinated domains, CSRF strategy, and a wider migration
of current auth; raw tokens in the redirect URL are simpler but leak through
history/logs/referrers. Do not auto-link a password account by matching email:
explicit account linking must separately prove ownership of the existing account.

## 2026-09-23 — Finance groundwork before Phase 0 deployment; exact paise and scoped records
Owner requested development-first and learning at the end, so begin a small manual
finance slice while Phase 0 deployment and live Google consent await credentials.
Keep Phase 0 incomplete and uncommitted status visible; do not silently claim it
finished. Store INR amounts as integer paise, validate a strict shared DTO, derive
`userId` solely from the verified token, index user/time, and cap recent results at 50.
Alternatives: floating-point rupees (rounding errors in money), Decimal128 (more
flexible currency/precision but extra serialization and UI complexity), managed
currency library (appropriate when multi-currency arrives, premature for INR MVP).
Manual entry exercises real persistence and isolation without needing mobile
notification permissions or email credentials; those remain required next slices.
