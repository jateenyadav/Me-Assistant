# 00 — Onboarding (read this first, every session)

**LifeOS** is one app that unifies a person's daily life: **finance** (auto-categorizing
transactions from phone notifications + email), **diet/calories**, **workout**,
**medication**, **notes**, **reminders**, and **goals** — all with a built-in **AI
assistant** that answers questions grounded in the user's own data and is also exposed as
an **MCP server** so any MCP-compatible client can use the same tools.

Clients: Flutter mobile (Android + iOS), Next.js web dashboard. Backend: NestJS. Data:
MongoDB Atlas + Redis + a vector store (notes only).

## Why this project exists
The user is a ~3-yr engineer using LifeOS to master **end-to-end system design** for
interviews. Therefore every task has **two deliverables**: working code **and** the concept
behind it. The `04_LEARNING_LOG.md` is the primary artifact this project produces — treat
it as first-class.

## Session START protocol (every session, no exceptions)
1. Read this file, then what it points to for today's task — at minimum
   [03_PROGRESS.md](03_PROGRESS.md), [06_ROADMAP.md](06_ROADMAP.md), [02_REQUIREMENTS.md](02_REQUIREMENTS.md).
2. Before writing any code, state in 2–3 lines your understanding of current state (a
   cheap staleness check that also lets the user confirm you picked up context).
3. If `/docs/memory/` were missing, that's session one — create it and start Phase 0.

## Session END protocol (every session, before stopping)
1. Rewrite [03_PROGRESS.md](03_PROGRESS.md): shipped / mid-flight / next / blockers.
2. Fold any new requirement into [02_REQUIREMENTS.md](02_REQUIREMENTS.md).
3. Confirm anything newly taught landed in [04_LEARNING_LOG.md](04_LEARNING_LOG.md).
4. Log architecture/library calls in [02_DECISIONS.md](02_DECISIONS.md) (with alternatives + why).
5. Check off [06_ROADMAP.md](06_ROADMAP.md); draft resume bullets in `03_PROGRESS.md`.
6. Tell the user to commit.

## Teach-while-building protocol
First time any concept appears (JWT rotation, caching, queues, MCP, webhooks, …), stop and
cover briefly: **what it is & why here**, **2–3 alternatives + trade-offs**, **what changes
at 100k users**, **the interview angle**. Then append a short entry to `04_LEARNING_LOG.md`
tagged to the commit/feature. A log entry is not evidence the user learned the concept:
if they ask for an explanation, teach it again from the beginning.

**Beginner-first rule (owner request, 2026-09-23):** Before implementing a new slice,
teach the process in chat in plain language, using an example from this repo. Trace one
real request through the UI → HTTP endpoint → validation → service → database → response;
explain vocabulary and where code/config lives; give a safe hands-on check. Then cover
alternatives and trade-offs, what changes at 100k users, and an interview question with
its answer. Pause at a comprehension checkpoint before jumping into the next major
concept; don't substitute a documentation update or a feature summary for teaching.
Mark the teaching checkpoint in the roadmap only once it has actually happened.

## The memory bank
- [01_ARCHITECTURE.md](01_ARCHITECTURE.md) — system design, stack + why, folder layout, data models
- [02_DECISIONS.md](02_DECISIONS.md) — append-only decision log
- [02_REQUIREMENTS.md](02_REQUIREMENTS.md) — living copy of the non-negotiable requirements
- [03_PROGRESS.md](03_PROGRESS.md) — current state + resume bullets (rewritten each session)
- [04_LEARNING_LOG.md](04_LEARNING_LOG.md) — append-only concept log (the interview-prep artifact)
- [05_API_CONTRACTS.md](05_API_CONTRACTS.md) — REST endpoints + MCP tools
- [06_ROADMAP.md](06_ROADMAP.md) — the phase checklist, ticked off live
