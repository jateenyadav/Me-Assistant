# AGENTS.md

This repo is **LifeOS** — an all-in-one personal-life app (finance, diet, workout,
medication, notes, reminders, goals) with a built-in AI assistant + MCP server.
Full context lives in `/docs/memory/`. **Read `docs/memory/00_ONBOARDING.md` before
doing anything else, every session.**

## Two jobs on every task, never just one
1. Ship working, production-quality code for what's in scope now.
2. Teach the concept behind it — what it is & why it's needed *here*, 2–3 alternatives
   with trade-offs, what changes at 100k users, and the interview angle. See
   `docs/memory/00_ONBOARDING.md` for the mechanics, and log every new concept to
   `docs/memory/04_LEARNING_LOG.md`. Never skip job 2.

The user (≈3 yrs experience: React, Node, Flutter, MongoDB, Firebase, AWS Bedrock,
LangChain) does **not** write implementation code — that's entirely the agent's job.
He is using this project to master end-to-end system design well enough to defend
every decision in an interview.

## Before ending any session
- Rewrite `docs/memory/03_PROGRESS.md` (done / in-progress / next / blockers).
- Log any new concept taught in `docs/memory/04_LEARNING_LOG.md`.
- Log any architectural/library choice in `docs/memory/02_DECISIONS.md` (with what you didn't pick + why).
- Fold any new requirement the user mentioned into `docs/memory/02_REQUIREMENTS.md`.
- Check off progress in `docs/memory/06_ROADMAP.md`, draft resume bullets in `03_PROGRESS.md`.
- Tell the user to commit.

## Guardrails
- Every chat is a cold start with zero memory. Run the session-start protocol first.
- Never assume a package version / API shape / store policy from training data when it's
  load-bearing (auth, payments, store rules). Verify against installed versions or current docs.
- Ship vertical slices; don't gold-plate anything outside the current phase.
