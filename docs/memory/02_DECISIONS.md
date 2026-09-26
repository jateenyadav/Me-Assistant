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

## 2026-09-23 — Forward-only Android listener; idempotent notification imports
Use Flutter for UI and a tiny native Kotlin `NotificationListenerService` for
new posted notifications. Never call `getActiveNotifications`; allowlist supported
payment apps and reject low-confidence/OTP/failure messages. Require a separate
in-app affirmative consent and Android listener grant before capture. Store only
parsed candidates in no-backup, app-private storage while offline; upload when
the app opens and discard each candidate only after server acknowledgement.
Android alerts open the app; the category picker lives in Flutter, not a
background server push. Mobile tokens are memory-only pending a secure persistent
session design. Device/vendor validation remains open before claiming release ready.

Use one `Transaction` document as either pending (no category) or categorized;
atomic upsert and a unique (userId, source, sourceEventId) index make retries
idempotent. `UpiMapping` stores a user/type-scoped HMAC of the counterparty UPI
ID (domain-separated with userId under the existing JWT secret); raw IDs never
persist on the API. Rotation of the JWT secret also invalidates learned mappings:
move to a separately managed matching key before planned key rotation.

Alternatives: background upload/FCM improves timeliness but requires durable mobile
credentials, background execution guarantees and a push channel; BullMQ/Socket.io
would add distributed infrastructure before a working capture path. A separate
`PendingImport` collection keeps completed transactions strictly categorized but
needs cross-collection consistency on classification. Raw UPI strings simplify
lookup but leak sensitive identifiers at rest. Distinct email and Android events
can still duplicate a transaction: reconciliation is the next import slice.

## 2026-09-23 — Review-first pasted email import before mailbox integration
Expose an authenticated email **preview** and explicit **confirm** endpoint in
the existing finance API. Reject ambiguous amounts/direction and unpaid messages;
reparse on confirmation and store only structured fields. A domain-separated,
user-scoped HMAC of normalized text and user-confirmed payment time (not raw mail)
uses the existing JWT secret and the existing unique source/event index for
same-input idempotency. Identical generic receipt text on different dates remains
importable. A nearby-amount warning in the web UI invites manual comparison; do
not silently merge distinct payments based on amount/time alone.

Alternatives: mailbox OAuth plus polling gives real automatic iOS coverage but
requires sensitive mailbox permissions, secure token storage, provider review,
sync cursors and explicit consent not provisioned for this slice; an inbound
forwarding address needs verified routing and abuse protection; a read-then-insert
dedupe check races on concurrent retries. Text-only fingerprints would collapse
separate identical receipts, while amount/time-based automatic cross-source merges
risk discarding real payments. Existing JWT secret rotation changes the fingerprint
key; use a dedicated versioned key before rotating it. Pasted email authenticity
is unverified, and duplicate detection across sources remains open. The web path
is usable on iOS in a browser, not a native share flow.

## 2026-09-24 — Version the Android Gradle wrapper for native tests
Track `gradlew`, `gradlew.bat`, and `gradle-wrapper.jar` with the Flutter Android
project, while continuing to ignore `local.properties`, `.gradle`, credentials,
and generated builds. The README's native test command must work on a fresh
checkout; leaving its bootstrap files ignored makes the test unreproducible.
Normalize the Windows launcher in Git while retaining CRLF on checkout.

Alternatives: require each developer to install a compatible system Gradle
(version drift and onboarding friction); regenerate the Flutter Android project
before native testing (risks overwriting app-specific listener code); or commit
the wrapper files, letting Gradle install the version pinned by the wrapper
properties. In CI, verify wrapper provenance and cache dependencies rather than
committing dependency caches or local paths.

## 2026-09-24 — Server-owned rolling finance summary
Calculate a 30 × 24-hour UTC rolling window with a MongoDB `$match` scoped to
the authenticated user, completed (categorized) records and occurrence time,
then `$group` by type/category. Sum paise as Decimal128 and return safe-integer
totals. The dashboard fetches this endpoint independently of its 50-item recent
history so analytics does not change when the list is truncated. Include only
payments within the window, not future-dated entries or pending Android imports.

Alternatives: summing the latest 50 records in React misses older transactions;
loading all user records to compute totals increases payload and client memory;
precomputed daily rollups speed up reads but require backfill, reconciliation,
and correction logic when a payment is categorized late. At higher volume add a
compound index that matches summary filters and consider per-day rollups only
after measuring aggregation latency.

## 2026-09-26 — Cursor-paged finance history and six-month UTC trends
Use an exclusive `(occurredAt, _id)` cursor against the existing compound
`(userId, occurredAt desc, _id desc)` index. Return at most 50 records with a
`nextCursor` only when a 51st exists; validate the encoded cursor, and always
scope database queries to the authenticated user rather than trusting the cursor
for access control. Aggregate the current and preceding five calendar months in
MongoDB using UTC `$dateTrunc` and Decimal128 paise, filling empty months in
the API before rendering the web dashboard. The current month is partial.

Alternatives: offset/skip pagination is simpler but slows at deep offsets and
shifts under inserts; loading all history on the client uses unbounded memory;
stored monthly rollups reduce repeated aggregate cost but require backfills
and correction logic. An unsigned encoded cursor is sufficient here because
it is not authorization: every read remains user-scoped, and a forged but
valid cursor can only change where that user's list starts. At higher volume,
measure query plans and roll up per-user monthly totals if needed.

## 2026-09-26 — Use schema ObjectId types for persisted ownership fields
Declare `userId` using `Schema.Types.ObjectId` in the finance and auth models;
construct values with `new Types.ObjectId(id)` at runtime. The earlier use of
`Types.ObjectId` as a schema type was actually `Mixed`: Mongoose did not cast
IDs, and the bulk-insert smoke exposed string-owned rows missing from list
queries. The change aligns query, stored document, and index key types.

Alternatives: leave Mixed and manually convert at every write (fragile, no
schema enforcement); store strings everywhere (migration of existing BSON IDs
and larger indexes); use schema ObjectId with casting (smallest safe correction).
Existing records written by the API already use BSON ObjectIds. If externally
written string-owned records exist, audit and migrate them with explicit owner
verification before relying on them in reads; this session did not migrate data.

## 2026-09-26 — Cross-phase delivery without false release claims
The owner's one-go request supersedes phase-gated implementation. Integrate
modules together and validate their boundaries, but retain unchecked release
criteria when provider accounts, physical devices or store approvals are absent.
Alternative: a strict phase gate blocks independent work on deployment; calling
local builds a finished release obscures risk. No automatic commits or pushes
of an unreviewed multi-module working tree.

## 2026-09-26 — Typed LifeRecord and measured goal progress
Use a single owner-indexed collection with kind-specific validated payloads
for initial diet/workout/medication/notes/reminders/goals flows. Compute
supported progress from real owner records, flag unsupported units instead of
inventing progress. Alternatives: separate collections per module enable
specialized indexes and scaling (likely useful at 100k users); flexible
unvalidated documents are easier but unsafe for medication and tenant data.
Scheduled AI goal prioritization remains unimplemented.

## 2026-09-26 — Fixed-host catalogs and bounded read-only AI
USDA and OFF only expose reported nutrients; wger exercises cache in-process
for one hour with bounded page fetches. Alternatives: hand-seeded foods mislead
on coverage, repeated upstream queries cost latency, and Redis offers a
shared multi-instance cache once necessary. AI reuses owner-scoped tool
execution to gather bounded context with explicit request consent, but cannot
write. Vector search for notes and adversarial prompt evaluation remain open;
fully autonomous writes require stricter authorization and confirmations.

## 2026-09-26 — Scoped MCP tokens and authenticated BYOK encryption
The installed MCP v2 server uses stateless Streamable HTTP, short-lived
revocable per-owner opaque tokens hashed at rest, and separate read/write
scopes instead of sharing web JWTs. AES-256-GCM encrypts each BYOK key with
a random IV, authentication tag and owner/provider associated data; provider
model IDs come from deployment config. Alternatives: sharing web JWTs widens
exposure; plaintext DB keys leak provider access; OAuth discovery is better
for arbitrary public clients but is not implemented. At 100k users add token
rate limits, audit logs, KMS rotation and interoperable OAuth.

## 2026-09-26 — iOS runner with explicit email-paste fallback
Generate Flutter's iOS runner, guard all Android-only notification channel
calls and offer iOS preview/time/category confirmation for pasted payments.
The simulator uses localhost in debug; releases require HTTPS. Alternatives:
web-only iOS fallback cannot satisfy app delivery; Android's listener cannot
serve iOS; automatic mailbox sync requires separate OAuth consent, provider
credentials and robust deduplication. Manual paste is not automatic ingestion.

## 2026-09-26 — Local-feedback CI without production credentials
Add GitHub Actions with read-only repository access, pnpm lockfile install,
API/web build/typecheck/unit tests and Linux Flutter tests. No Atlas or
provider secrets are required for this first workflow. Alternatives: builds
alone miss authorization regressions; running real production credentials
on arbitrary PRs risks leaking them. At scale add isolated temporary DB
integration tests, macOS iOS builds and signed deployment gates.

## 2026-09-26 — Server-side rolling nutrition summary
Aggregate all owner-scoped food logs in the rolling 30-day window in MongoDB,
using decimal conversion for nutrient totals and explicit range checks. A
recent-list sum silently misses logs after the 100-record display limit;
client download is unbounded; a materialized daily rollup is faster but needs
corrections on edits and deletions. At 100k users benchmark the existing
owner/kind/time index and consider pre-aggregation when measurements justify it.

## 2026-09-26 — Bounded server-side workout volume
Group owner-scoped logged exercise sets by entered exercise name in MongoDB;
return the top 30 by lifetime repetitions × weight volume and heaviest
logged weight. Time-only or unweighted sets add zero volume, not invented
resistance. Alternatives: recent 100-workout client sums lose older history;
downloading all sessions is unbounded; daily rollups need edit/delete
correction. At 100k users normalize exercise IDs and add dated PR trends.
