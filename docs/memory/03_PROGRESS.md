# 03 — Progress (rewritten every session)

_Last updated: 2026-09-23 (HTTP request/validation lesson delivered)_

## Current phase
**Phase 0 — Foundation** (in progress; deployment pending)

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

## In progress
- Live deployment still requires owner-provisioned hosting accounts and secrets.
- Repository has no commits yet; Phase 1 waits for the Phase 0 commit and roadmap update.
- Phase 0 teaching remains in progress: the HTTP request/validation lesson was
  delivered, but the owner has not yet completed its comprehension checkpoint;
  database and JWT deep-dives are next.
- Local API and web servers are currently stopped; prior smoke results are historical.

## Next
- First, hear the owner's request-validation teach-back, then teach MongoDB and JWT
  one at a time with hands-on checks. Leave the roadmap teaching checkpoint open
  until the owner confirms understanding; then ask for the Phase 0 commit.
- Deploy empty API + web, verify production health/auth, then close Phase 0 and begin
  Phase 1 finance (notification listener + email fallback).

## Blockers
- Deployment needs the user's hosting accounts and secrets.

---
## Resume bullets
_(Draft 1–2 per completed phase; refine with real numbers.)_
- Architected a TypeScript monorepo (pnpm + Turborepo) for LifeOS spanning a NestJS API,
  Next.js dashboard, and shared type package with Zod-validated DTOs shared across services.
- Built JWT auth with hashed rotating refresh tokens, verified over HTTP against Atlas;
  prevented unauthenticated token revocation and concurrent double-claims.
