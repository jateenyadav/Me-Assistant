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
