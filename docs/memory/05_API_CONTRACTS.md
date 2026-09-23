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

### Finance (`/transactions`, manual-entry slice)
| Method | Path | Auth | Body → Result |
|---|---|---|---|
| GET | `/transactions` | access token (Bearer) | → `{ transactions: PublicTransaction[] }` (50 newest, current user only) |
| POST | `/transactions` | access token (Bearer) | `{ amountMinor, type, category, occurredAt, note? }` → `{ transaction }` (`201`) |

`amountMinor` is integer paise, not a floating-point rupee amount; currency is fixed
to INR. Type is `expense` or `income`; categories: `food`, `shopping`, `transport`,
`bills`, `health`, `other`. `occurredAt` is an ISO timestamp with timezone; `note`
is at most 140 characters. Server derives `userId` from the verified access token
and rejects extra fields; `currency` and `source: manual` are server-owned. The
response never includes `userId`. Notification/email imports are not yet available.

---

## MCP tools (Phase 5 — not built yet)
Planned tools, each `userId`-scoped and authed via a **separate scoped token** (not the web
session): `get_transactions`, `get_food_log`, `log_workout`, `get_goal_progress`,
`add_note`, … The built-in assistant calls these same tools. Contracts to be filled in when built.
