# Threat Model

## Project Overview

ReceiptBud is a Node.js/Express (Express 5) API server with a React frontend. Users scan receipts via AI (OpenRouter/Gemini), track spending, manage budgets and subscriptions, and chat with an AI financial assistant ("Bud"). Authentication is handled by Clerk. The database is PostgreSQL accessed via Drizzle ORM. The app is not currently deployed.

## Assets

- **User financial data** — receipts (store names, totals, items, dates, base64 images), budgets, subscriptions. Disclosure reveals spending habits and PII.
- **AI conversation history** — chat messages with the "Bud" AI assistant may contain sensitive financial questions and personal context.
- **User profiles** — name, email, currency preference, language, theme settings.
- **Application secrets** — `CLERK_SECRET_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `DATABASE_URL`. Leakage enables impersonation, API abuse, and full database access.
- **Clerk session tokens** — compromise allows impersonation of any user.

## Trust Boundaries

- **Browser to API** — all client requests cross this boundary; the API must authenticate and authorize every request.
- **API to PostgreSQL** — Drizzle ORM with parameterized queries; SQL injection risk is low.
- **API to OpenRouter/Gemini** — server calls external AI APIs with secret keys; key leakage allows unauthorized API usage.
- **Authenticated to Unauthenticated** — `/api/healthz` is public; all other routes require Clerk authentication via `requireAuth` middleware.
- **User to User (tenant isolation)** — each user's data is scoped server-side via `and(eq(table.id, id), eq(table.userId, userId))` patterns on all read/write/delete operations.

## Scan Anchors

- **Production entry points**: `artifacts/api-server/src/routes/` — all Express route handlers
- **Auth enforcement**: `artifacts/api-server/src/middlewares/requireAuth.ts`
- **Rate limiting**: `artifacts/api-server/src/middlewares/rateLimiters.ts` — per-user in-memory limits on scan (10/min), chat (30/min), image generation (5/min)
- **Highest-risk areas**: `/api/receipts/scan` (rate-limited, 50 MB body parser, expensive AI call) and `/api/gemini/conversations/:id/messages` (rate-limited, 100-message cap per conversation)
- **Public surface**: `/api/healthz` (no auth required)
- **Dev-only**: `artifacts/mockup-sandbox/` — UI mockup sandbox, not reachable in production API context

## Threat Categories

### Spoofing

Clerk handles authentication. The `requireAuth` middleware verifies the Clerk session and attaches `userId` to the request. The middleware correctly rejects unauthenticated requests with a 401. No spoofing weakness identified in the auth flow itself.

### Tampering

All database mutations use Drizzle ORM parameterized queries — no SQL injection risk observed. Object-level authorization on receipts, budgets, subscriptions, and Gemini conversations correctly scopes all reads, writes, and deletes to the requesting user's `userId` (including `and(eq(...id), eq(...userId))` patterns throughout). No BOLA found.

### Information Disclosure

CORS is configured with an explicit allowlist built from `REPLIT_DOMAINS` plus localhost dev ports — arbitrary-origin reflection with credentials is not present. Receipt images are stored as base64 strings in the database; if the database is compromised, full image data is exposed. All API responses are scoped to the authenticated user.

### Denial of Service

Per-user rate limiting is implemented on all expensive AI endpoints via `express-rate-limit`:
- Receipt scanning: 10 requests/user/minute
- Chat messages: 30 messages/user/minute
- Image generation: 5 requests/user/minute
- Conversation message cap: 100 messages per conversation

The Express body parser allows up to 50 MB JSON payloads, which is large but necessary for base64-encoded receipt images. The in-memory rate limiter will reset on server restart and won't scale across multiple instances; a Redis store would be required for horizontal scaling.

### Elevation of Privilege

No admin role or multi-tier privilege system exists. All authenticated users are equal. Ownership checks use `and(eq(table.id, id), eq(table.userId, userId))` patterns consistently across all routes. No path traversal or injection sinks are reachable in production code.

### Dependency Risk

Previously reported CVEs are now mitigated via `pnpm.overrides`:
- `js-yaml` forced to `^4.3.0` (fixes CVE-2026-59869 / GHSA-52cp-r559-cp3m — build-time only)
- `esbuild` forced to `>=0.25.0` (fixes GHSA-67mh-4wv8-2f99 and GHSA-g7r4-m6w7-qqqr — dev-only)

No known production-impacting dependency vulnerabilities remain.
