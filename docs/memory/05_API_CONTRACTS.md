# 05 — API Contracts (REST + MCP tools)

## REST endpoints

### Health
| Method | Path | Auth | Body / Result |
|---|---|---|---|
| GET | `/health` | none | `{ status, db }` — DB ping |

### Auth (`/auth`)
| Method | Path | Auth | Body → Result |
|---|---|---|---|
| POST | `/auth/register` | none | `{ email, password }` → `{ user, accessToken, refreshToken }` |
| POST | `/auth/login` | none | `{ email, password }` → `{ user, accessToken, refreshToken }` |
| POST | `/auth/refresh` | refresh token | `{ refreshToken }` → `{ accessToken, refreshToken }` (old one revoked) |
| POST | `/auth/logout` | refresh token | `{ refreshToken }` → `204` (token revoked) |
| GET | `/auth/me` | access token (Bearer) | → `{ user }` |
| GET | `/auth/google?state=<client-state>` | none | Redirect to Google, set short-lived state cookie and DB authorization attempt |
| GET | `/auth/google/callback` | Google redirect + browser state cookie | Validate Google code/identity; redirect to web `/auth/google/complete#ticket=...&state=...` |
| POST | `/auth/google/exchange` | one-use ticket | `{ ticket }` → `{ user, accessToken, refreshToken }` |

DTOs are defined once in `packages/shared` (Zod schemas) and reused by web + API.

**Token semantics:** access token = short-lived JWT (Bearer header). Refresh token =
long-lived, rotated on every `/refresh`, stored hashed server-side. Reuse of a rotated
refresh token ⇒ revoke chain.

**Google sign-in:** The browser holds a random client state in `sessionStorage`;
the API holds a separate HttpOnly cookie-bound state and a TTL-indexed MongoDB
authorization attempt containing PKCE verifier and OIDC nonce. The API verifies
Google's signed ID token, audience, nonce, and email verification, then finds
the local account by Google's stable `sub` (never silently links a password
account by email). The 60-second, hashed one-use DB ticket is returned in the
URL fragment, checked against client state and atomically exchanged for the
standard LifeOS session. No Google provider token is persisted.

### Finance (`/transactions`)
| Method | Path | Auth | Body → Result |
|---|---|---|---|
| GET | `/transactions?cursor=<optional>` | access token (Bearer) | → `{ transactions: PublicTransaction[], nextCursor: string \| null }` (50 per page, sorted newest first by occurrence time then ID, current user's categorized records only; 400 for malformed cursors) |
| GET | `/transactions/summary` | access token (Bearer) | → `{ summary: { from, to, expenseMinor, incomeMinor, expenseByCategory: { category, amountMinor }[] } }` (rolling 30 × 24-hour period, completed transactions only) |
| GET | `/transactions/trend` | access token (Bearer) | → `{ trend: { months: { month: "YYYY-MM", expenseMinor, incomeMinor }[] } }` (six UTC calendar months including current partial month; completed transactions only) |
| POST | `/transactions` | access token (Bearer) | `{ amountMinor, type, category, occurredAt, note? }` → `{ transaction }` (`201`) |
| POST | `/transactions/emails/preview` | access token (Bearer) | `{ text }` → `{ payment: { amountMinor, type } }`; 400 if ambiguous/unpaid (no persistence) |
| POST | `/transactions/emails` | access token (Bearer) | `{ text, category, occurredAt }` → `{ transaction }` (`source: "email_paste"`); 409 on replay with different category |
| POST | `/transactions/notifications` | access token (Bearer) | `{ eventId, amountMinor, type, occurredAt, upiId? }` → `{ status: "pending", notification }` or `{ status: "categorized", transaction }` |
| GET | `/transactions/notifications/pending` | access token (Bearer) | → `{ notifications: PendingNotification[] }` (50 newest, current user only) |
| PATCH | `/transactions/notifications/:id/category` | access token (Bearer) | `{ category }` → `{ transaction }` (404 for other user's ID; 409 if already categorized differently) |

`amountMinor` is integer paise, not a floating-point rupee amount; currency is fixed
to INR. Type is `expense` or `income`; categories: `food`, `shopping`, `transport`,
`bills`, `health`, `other`. `occurredAt` is an ISO timestamp with timezone; `note`
is at most 140 characters. Server derives `userId` from the verified access token
and rejects extra fields; `currency` and `source` are server-owned. The
response never includes `userId` or the hashed UPI ID. Pending notifications do
not appear in the standard transaction list until categorized. Notification event
IDs are SHA-256 hex fingerprints of Android package, notification key and post
time; uniqueness is per user/source, and a replay with changed data returns 409.
Only an explicit UPI counterparty ID is used to learn the category. Email paste
is a **manual**, review-first path, not mailbox authorization or verified sender
identity: the API reparses the text rather than trusting preview values. It accepts
one completed INR payment amount/direction and rejects failed, unpaid or ambiguous
messages. The raw email text is not stored; a keyed per-user fingerprint of the
normalized text **and the user-confirmed payment time** is used for same-input
replay. Identical emails for different payment times can be entered separately;
changed time for the same email may create a second record. The dashboard warns on
similar recent amounts, but cross-source reconciliation and automatic email sync
are not yet available.

The summary aggregates all categorized records for the authenticated user in the
rolling 30-day window, including imported payments. It excludes pending imports
and future-dated records. Aggregation sums paise as MongoDB Decimal128 to avoid
floating-point drift and rejects totals outside JavaScript's safe-integer range.
The trend applies the same user/completed/future filters over six UTC calendar
months and fills empty months with zeros. The cursor is an encoded occurrence
timestamp and document ID, not an authorization token; it is validated but not
signed. Every page is still filtered by the authenticated user's ID. Concurrent
inserts/deletes can change what appears between requests, but the exclusive
time-and-ID boundary prevents a record at the boundary from being repeated.

---

## Life records, catalog, and profile (implemented locally)

All endpoints below require a LifeOS JWT. Life record kinds are `food`,
`workout`, `medication`, `medication-intake`, `note`, `reminder`, and `goal`.
The strict kind-specific request schemas live in `packages/shared/src/life.ts`.
Dates include an offset; ownership is derived from JWT and never returned.

| Method | Path | Result |
|---|---|---|
| GET | `/life/:kind` | `{ entries: LifeEntry[] }`, newest 100 |
| POST | `/life/:kind` | Validated kind payload → `{ entry }` |
| PUT | `/life/:kind/:id` | Full replacement → `{ entry }`; foreign ID 404 |
| DELETE | `/life/:kind/:id` | 204; medications with intake history cannot be deleted |
| GET | `/life/food/summary` | `{ summary: {from,to,count,calories,proteinGrams,carbohydratesGrams,fatGrams} }`, completed logs in rolling 30 days |
| GET | `/life/workout/stats` | `{ exercises: [{exercise,sets,heaviestKg,volumeKg}] }`, top 30 by logged lifetime volume |
| GET | `/life/goals/progress` | `{ progress: [{goalId,domain,target,unit,current,status}] }` |
| PATCH | `/auth/profile` | `{heightCm?,weightKg?,goal?}` → `{user}` |
| GET | `/catalog/foods?q=…` | `{ foods: CatalogFood[] }`; needs USDA API key |
| GET | `/catalog/barcode/:barcode` | `{ food: CatalogFood \| null }`; OFF barcode **lookup**, no camera |
| GET | `/catalog/exercises?q=…` | `{ exercises: CatalogExercise[] }`; wger catalog |

Missing per-100g catalog nutrients remain null, not invented. Goals measure
INR net inflow, logged kcal, workout sessions, or **taken** medication doses
since creation; other goal units have `current: null, status: "unsupported"`.
Daily AI prioritization is not yet present.
Workout volume is logged repetitions × logged weight in kilograms; time-only
and unweighted sets contribute zero. User-entered exercise names are not
canonicalized, and similarly named exercises can appear separately.

## AI and MCP (partial implementation)

| Method | Path | Authentication | Result |
|---|---|---|---|
| GET/PATCH | `/mcp/settings` | JWT | `{enabled}`; disabling revokes tokens |
| GET/POST | `/mcp/tokens` | JWT | Token metadata; POST `{label,scopes:["read","write"]}` shows opaque secret **once**, expires in 90 days |
| DELETE | `/mcp/tokens/:id` | JWT | 204, owner-only revoke |
| POST | `/mcp` | Scoped `Bearer mcp_…` | Stateless MCP Streamable HTTP JSON; read: `get_transactions`, `get_food_log`, `get_notes`, `get_goal_progress`; write: `add_note`, `log_workout` |
| GET/POST | `/ai/keys` | JWT | List configured providers without secrets; POST `{provider,key}` saves encrypted BYOK key |
| DELETE | `/ai/keys/:provider` | JWT | 204, remove saved key |
| POST | `/ai/chat` | JWT | `{provider,question,consent:true}` → `{answer,provider,coverage}`; read-only personal context |

MCP is off by default; token hashes, scopes and expiry are checked each
request, independently of web JWTs. OAuth discovery/client registration is
**not** implemented, so not all MCP clients can connect. Live AI provider
invocation is unverified and requires server model/credential configuration.
BYOK requires a base64-encoded 32-byte `AI_ENCRYPTION_KEY`; Bedrock uses AWS
credentials and `BEDROCK_MODEL_ID`. Notes currently use bounded recent text,
**not vector RAG**. AI output is not medication advice.
