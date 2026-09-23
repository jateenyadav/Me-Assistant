# LifeOS

One app for your whole life: finance (auto-categorized from notifications + email), diet,
workout, medication, notes, reminders, and goals — with a built-in AI assistant that's also
exposed as an MCP server.

> **Agents:** read [`docs/memory/00_ONBOARDING.md`](docs/memory/00_ONBOARDING.md) first,
> every session. Full project context lives in [`docs/memory/`](docs/memory/).

## Monorepo layout
```
apps/api      NestJS backend (@lifeos/api)
apps/web      Next.js App Router dashboard (@lifeos/web)
apps/mobile   Flutter app (placeholder until Phase 1)
packages/shared  @lifeos/shared — shared TS types + Zod DTOs
docs/memory   persistent project context (the "memory bank")
```

## Getting started (local)
```bash
pnpm install                      # install all workspaces
pnpm --filter @lifeos/shared build

# API
cp apps/api/.env.example apps/api/.env    # set MONGODB_URI + JWT_ACCESS_SECRET
pnpm --filter @lifeos/api start:dev       # http://localhost:4000

# Once Atlas/local MongoDB is reachable, verify auth over HTTP.
# Creates and removes only one uniquely named test user and its refresh tokens.
pnpm --filter @lifeos/api test:smoke

# Web
cp apps/web/.env.local.example apps/web/.env.local
pnpm --filter @lifeos/web dev             # http://localhost:3000
```
Needs Node ≥20, pnpm, and a MongoDB (local `mongodb://127.0.0.1:27017/lifeos` or Atlas).

## Tech stack
Next.js · NestJS · MongoDB (Mongoose) · Redis · BullMQ · Socket.io · Flutter · LangChain +
MCP · Razorpay. See [`docs/memory/01_ARCHITECTURE.md`](docs/memory/01_ARCHITECTURE.md).
