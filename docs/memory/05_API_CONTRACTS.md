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

DTOs are defined once in `packages/shared` (Zod schemas) and reused by web + API.

**Token semantics:** access token = short-lived JWT (Bearer header). Refresh token =
long-lived, rotated on every `/refresh`, stored hashed server-side. Reuse of a rotated
refresh token ⇒ revoke chain.

---

## MCP tools (Phase 5 — not built yet)
Planned tools, each `userId`-scoped and authed via a **separate scoped token** (not the web
session): `get_transactions`, `get_food_log`, `log_workout`, `get_goal_progress`,
`add_note`, … The built-in assistant calls these same tools. Contracts to be filled in when built.
