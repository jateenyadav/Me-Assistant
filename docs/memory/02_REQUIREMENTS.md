# 02 — Requirements (living copy — update as new asks arrive)

These are the project owner's non-negotiables. If one seems like a bad idea, say so and
explain — don't silently build something else. New requirements typed into any chat get
folded in here before that session ends.

## Finance module
- Reads phone notifications **going forward only** — never scans notification history.
- On a likely transaction, raise an alert asking what it was for, with category options.
- If the UPI id matches one seen before → skip the prompt, auto-categorize.
- Also parse relevant emails (bills, payment confirmations) as a second signal source.
  Email is the **primary** path on **iOS** (no notification-reading API there — see stores).
- Dashboard scope (spend by category, trends, …) decided fresh when Phase 1 starts.

## Diet / calorie module
- Nutrition data genuinely comprehensive across generic + branded/packaged foods (not
  hand-seeded). USDA FoodData Central + Open Food Facts.
- Barcode scan, manual entry, meal logging with macro/micro rollups, recipes, summaries.
- Store height/weight/goals per user so the AI can reason about food + exercise together.

## Workout module
- Exercise data covers the realistic range of movements + how they combine (supersets,
  circuits, splits, progressive overload) — structured data, not a static list. wger / ExerciseDB.
- Set/rep/weight logging, rest timers, PR tracking, volume-over-time analytics.

## Goals module
- User sets goals tagged short-term / long-term.
- AI prioritizes + reasons using **real data** from whichever module each goal touches
  (savings goal → finance; weight goal → diet + workout). Recompute daily on a schedule.

## AI layer (required across every module)
- Built-in assistant powered by LLM APIs, grounded in the user's own data.
- Exposed as an **MCP server** so any MCP-compatible client can use the same tools.
- **RAG only where structured lookups aren't enough** (free text like Notes). Everything
  else calls the same MCP tools — no second retrieval system.
- Provider layer: LangChain over Bedrock (default) + OpenAI/Anthropic/Google via **BYOK**.
  API keys **encrypted at rest, never logged**, sent only to their own provider.
- "Its own LLM" = a built-in feature powered by LLM APIs, **not** training a foundation model.

## Also required (all in this one app)
Medication tracking · notes · reminders (incl. recurring like birthdays) · BYOK external
AI keys · mobile app on **both** Play Store + App Store · web app · real database · real
production deployment.

## Cross-cutting concepts to master
Auth/RBAC + multi-tenancy · MCP as a protocol (tools/resources/prompts, auth) · caching +
invalidation · queues/async · mobile↔web sync (offline-first, conflict resolution) ·
scaling ("what changes at 100k users") · payments (webhooks, idempotency) · security
(secrets, encryption at rest for API keys) · CI/CD · testing (money + medication paths) ·
observability (structured logs, error tracking).

## Learning experience (non-negotiable)
- This project is the owner's end-to-end system-design/interview course, not just an app.
- **Current pacing (owner update 2026-09-23): develop first; save the learning
  walkthrough for the end.** Do not interrupt each slice for a comprehension check.
  Keep pending lessons and design decisions documented so none are lost.
- At the end, teach every process as a beginner would learn it, in chat: what an
  API/database/auth mechanism is, how to set it up, what each part does in the real
  LifeOS code, how to test it, and why the decision was made.
- Explain alternative approaches and trade-offs, how the design changes at 100k users,
  and a realistic interview question and answer for each concept.
- Pace the lessons with hands-on checks and comprehension checkpoints; never treat a
  learning-log entry or shipped code as proof the concept was taught or understood.
- The original repository link was `jateenyadav/LifeOS`; the owner subsequently
  confirmed `jateenyadav/Me-Assistant` as the active push destination.

## Delivery cadence
- Finish and validate one cohesive vertical slice end-to-end before moving to the
  next; avoid leaving multiple half-finished features in the working tree.
- Commit and push completed, validated slices periodically, not only at the end
  of the project. Push to the confirmed `origin` repository
  (`https://github.com/jateenyadav/Me-Assistant.git`); do not force-push.

## Google sign-in
- Support Google OAuth 2.0 / OpenID Connect web sign-in alongside email/password.
- Validate Google's identity on the API and issue the same LifeOS session tokens;
  do not auto-link a password account based only on a matching email address.
- Keep temporary login states and handoffs short-lived and one-use. Google client
  credentials are owner-supplied, private API settings, never committed.

---
### Change log
- 2026-09-20: Initial copy seeded from the master brief (Section 2).
- 2026-09-23: Owner reiterated beginner-first, step-by-step teaching of every process
  as a primary deliverable; added comprehension checkpoints and repository link.
- 2026-09-23: Owner requested a complete Google OAuth 2.0 sign-in process in addition
  to the existing email/password flow, with beginner-first teaching.
- 2026-09-23: Owner revised pacing: prioritize development now; do the teaching and
  comprehension checks at the end. Phase 0 deployment still needs their credentials.
- 2026-09-24: Owner requested complete slices in one go and periodic code pushes.
- 2026-09-24: Owner confirmed `Me-Assistant` rather than `LifeOS` for Git pushes.
