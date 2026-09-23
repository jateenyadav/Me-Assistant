# 03 — Progress (rewritten every session)

_Last updated: 2026-09-23 (manual finance slice + development-first pacing)_

## Current phase
**Phase 1 — Finance groundwork** (in progress by owner request; Phase 0 deployment,
Google live consent, and teaching checkpoints remain open)

## Done
- Bootstrapped persistent-context system: `AGENTS.md`, `CLAUDE.md`, `/docs/memory/` (8 files), root README.
- Monorepo scaffold (pnpm 12.5.1 + Turborepo 2.11.2): `apps/api`, `apps/web`, `apps/mobile` (placeholder), `packages/shared`.
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

## In progress
- Live deployment still requires owner-provisioned hosting accounts and secrets.
- Repository has an initial commit; current Google sign-in and finance work are
  uncommitted. Owner authorized development-first despite incomplete deployment.
- Learning walkthrough and teach-backs are deferred until the end at owner's
  request; Phase 0 teaching stays unchecked. Finance concepts logged as pending.
- Google live consent/callback still needs owner-created Web OAuth credentials.
- Local API and web dev servers are currently stopped; smoke ran in this session.

## Next
- Continue Phase 1 with Android forward-only notification capture and ingestion,
  classification prompts and email fallback; keep all imports user-scoped and
  plan idempotency before integrating multiple sources.
- Owner configures Google OAuth credentials to test real consent/callback and
  provisions hosting to deploy API + web; review and commit the current code.
- Revisit the pending DB/JWT/OIDC/finance lessons at the end, with hands-on
  checks and teach-backs before checking the roadmap teaching item.

## Blockers
- Deployment needs hosting accounts/secrets; live Google sign-in needs owner-created
  Google Web OAuth client ID/secret and registered callback URL. These do not
  block the local manual finance slice.

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
