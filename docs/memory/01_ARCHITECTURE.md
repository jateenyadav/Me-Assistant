# 01 — Architecture

## Tech stack (and why)
| Layer | Choice | Why |
|---|---|---|
| Mobile | Flutter (Android + iOS) | Matches user's skill set; one codebase, both stores |
| Web | **Next.js (App Router)** | SSR + App Router + server components = more interview surface than a plain SPA |
| Backend | **NestJS (TS)** | Modules, DI, guards, interceptors — the enterprise patterns interviewers probe |
| DB | MongoDB Atlas (Mongoose) | Flexible schema fits notes/reminders/goals; user already knows it |
| Auth | Custom JWT (access + refresh, rotated, hashed at rest) | Most-interviewed backend topic; teaches the mechanism under Firebase Auth |
| Cache | Redis (ioredis) | Sessions, hot nutrition/exercise lookups, AI response cache, notif de-dup |
| Queue | BullMQ (Redis-backed) | Decouples "notification arrived" from "transaction processed" |
| Realtime | Socket.io | Pushes the "what was this for?" alert instantly |
| AI | LangChain over multiple providers; **AWS Bedrock (Mumbai) default**, OpenAI/Anthropic/Google via BYOK; **MCP server** | One abstraction, swappable providers |
| Payments | Razorpay | Native UPI, standard for Indian apps, free test mode |
| Deploy (MVP) | Render/Railway (API) + Vercel (web) + Atlas free tier | (deferred until accounts ready) |

## Monorepo layout (pnpm + Turborepo)
```
lifeos/  (repo root: Me-Assistant)
  apps/
    api/      NestJS backend  (@lifeos/api)
    web/      Next.js dashboard (@lifeos/web)
    mobile/   Flutter app (placeholder until Phase 1)
  packages/
    shared/   @lifeos/shared — shared TS types + Zod schemas (auth DTOs, entities)
  docs/memory/
  pnpm-workspace.yaml · turbo.json · tsconfig.base.json · package.json
```
`packages/shared` is the single source of truth for DTO shapes so web + API validate identically.

## Key architectural rule
**Every collection is scoped by `userId` from day one**, even with one real user. This makes
"how would you make this multi-tenant?" a real design decision later, not a hypothetical.

## The novel flow (understand this cold for interviews)
Bank/UPI notification → Android NotificationListenerService (filtered to known payment apps,
forward-only) → parse (amount / merchant / UPI id / timestamp) → queue (BullMQ) → sync to API →
look up UPI id in `UpiMapping`:
- **seen before** → auto-categorize, save silently
- **new** → push Socket.io "what was this for?" alert → user picks category → save + remember mapping

iOS has **no** notification-reading API (Apple sandbox). iOS finance path = email parsing
(Gmail API) + manual entry. This asymmetry is a platform limit, documented for the stores.

## Data models (Section 5 entity shape — expand fields as built)
- `User` (auth, profile: height/weight/goals, role for RBAC)
- `Transaction` → belongs_to `Category`, matched_by `UpiMapping`
- `FoodLog` → references `FoodItem`
- `WorkoutLog` → contains `ExerciseSet` → references `Exercise`
- `Medication`, `Note`, `Reminder`, `Goal` (tagged short/long-term, linked to a module)

### Implemented so far (Phase 0)
- `User` { email (unique), passwordHash, role, profile{}, timestamps }
- `RefreshToken` { userId, tokenHash, expiresAt, revoked } — keyed/indexed by userId

## AI layer build order (Phase 5+)
1. **MCP server** first (tools: `get_transactions`, `log_workout`, `get_goal_progress`,
   `add_note`, `get_food_log`, …) with its **own scoped-token auth** (not the web session).
2. **Built-in assistant** reuses those same MCP tools as its tool-calling mechanism.
3. **RAG only for Notes** (free text). Structured data uses precise tool calls, not embeddings.
