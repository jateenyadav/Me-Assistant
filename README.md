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
apps/mobile   Flutter: Android capture + iOS email fallback
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

# Once Atlas/local MongoDB is reachable, verify auth and manual finance over HTTP.
# Creates and removes only uniquely named test users, tokens, and transactions.
pnpm --filter @lifeos/api test:smoke

# Web
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @lifeos/web dev             # http://localhost:3000
```
Needs Node ≥22 (Google's auth library requires it), pnpm, and MongoDB
(local `mongodb://127.0.0.1:27017/lifeos` or Atlas).

## Current local capabilities (not a release)
The authenticated web dashboard includes finance, food, workout, medication,
notes, reminder, goal and AI/MCP settings. Strict owner-scoped APIs back the
forms; food/exercise catalogs require the provider configuration described in
`apps/api/.env.example`. AI model requests require explicit user consent and
working Bedrock credentials or a saved encrypted provider key and model ID.
Notes RAG, OS reminders, full mobile parity and live AI requests are not built
or verified. See `docs/memory/03_PROGRESS.md` for exact tests and blockers.

## Finance
Sign in and open `/dashboard` to add INR expenses or income and see your 50 most
recent transactions. Amounts are entered in rupees and stored as integer paise;
only your account can access its records. The dashboard shows rolling 30-day
income, spending and spending by category across all completed transactions,
not only the 50 shown in recent history. Use
`pnpm --filter @lifeos/api test:finance` for offline money/isolation checks.
The dashboard also accepts **pasted payment-confirmation emails**: review the
detected INR amount and direction, enter the real payment time and category, and
confirm. The API rejects ambiguous/unpaid text, doesn't store the raw message and
deduplicates exact same-message/same-time retries per account. Pasted text is
user-supplied, not sender-verified; avoid importing a payment already captured on
Android. No mailbox sync, physical-device notification verification or
cross-source deduplication is built yet. The iOS Flutter app now offers manual
email preview/time/category confirmation; its sign-in screen launched in the
simulator, but the signed-in flow is not verified on device.

## Google sign-in (optional)
1. In Google Cloud Console, configure the OAuth consent screen and create an OAuth 2.0
   **Web application** client. For local development, add
   `http://localhost:4000/auth/google/callback` to its **Authorized redirect URIs**.
   Configure test users if the consent screen is in testing mode.
2. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in
   `apps/api/.env`. These values must correspond to that Web application client.
3. In `apps/web/.env.local`, set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` and make sure
   `NEXT_PUBLIC_API_URL` points to the API. Restart both development servers.
4. Open `/login`, select **Continue with Google**, finish the Google consent flow,
   and check that `/dashboard` shows your LifeOS account. Log out, then repeat to
   confirm it signs in to the same account.

For a deployment, use HTTPS and register its exact API callback URL in Google Cloud.
Keep the client secret only in the API environment; never put it in a `NEXT_PUBLIC_`
variable. Google sign-in does **not** silently merge with a password account sharing
the same email: sign in with the password instead. Google identity is keyed by its
stable subject (`sub`), not by email. The app exchanges an authorization code using
PKCE; a one-use ticket in the URL fragment hands the verified session to the web
app. Google sends its one-time code in the API callback query as required by the
authorization-code flow; the app never puts LifeOS session tokens in a URL.
The temporary sign-in attempts and tickets expire and are removed by MongoDB TTL
indexes; the API also checks expiry on use. Google live consent cannot be tested
without your own client credentials; `pnpm --filter @lifeos/api test:google` runs
offline tests of the flow's state, nonce, PKCE, expiry, and replay protections.

## Tech stack
Next.js · NestJS · MongoDB (Mongoose) · Redis · BullMQ · Socket.io · Flutter · LangChain +
MCP · Razorpay. See [`docs/memory/01_ARCHITECTURE.md`](docs/memory/01_ARCHITECTURE.md).
