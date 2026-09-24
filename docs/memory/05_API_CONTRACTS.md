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
| GET | `/transactions` | access token (Bearer) | → `{ transactions: PublicTransaction[] }` (50 newest, current user only) |
| GET | `/transactions/summary` | access token (Bearer) | → `{ summary: { from, to, expenseMinor, incomeMinor, expenseByCategory: { category, amountMinor }[] } }` (rolling 30 × 24-hour period, completed transactions only) |
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

---

## MCP tools (Phase 5 — not built yet)
Planned tools, each `userId`-scoped and authed via a **separate scoped token** (not the web
session): `get_transactions`, `get_food_log`, `log_workout`, `get_goal_progress`,
`add_note`, … The built-in assistant calls these same tools. Contracts to be filled in when built.
