<!-- .github/copilot-instructions.md - Project-specific guidance for AI coding agents -->
# Copilot instructions (project-specific)

Purpose: help an AI coding agent be productive in this Next.js + Postgres + Firebase project.

- **Big picture**: This is a Next.js (app router) TypeScript app with server and client components. UI lives under `src/app/`; API routes live under `src/app/api` and server helpers live in `src/lib`. Back-end integrations: PostgreSQL (via `pg`), Firebase Admin, and deployment targets include Vercel and Hetzner (see `.github/workflows/*`).

- **How to run / build**:
  - Dev: `npm run dev` (Next dev server).
  - Build: `npm run build` (Next build). Production start: `npm run start` or `npm run start:prod`.
  - Useful checks: `npm run lint`, `npm run test:db` (verifies DB connection using `test-connection.js`).
  - Migration / helper scripts live in `scripts/` (examples: `migrate:datum`, `migrate:devices`, `migrate:display-order`).

- **Key files / patterns to reference**:
  - `src/lib/db.ts` — centralized Postgres pool (`getPool()`), custom `.env.local` loading logic (explicitly reads `.env.local` for PM2/production). Important: this file manually parses and logs env vars and chooses SSL based on host; prefer using `getPool()` for DB access and `transaction()` for transactional work.
  - `src/lib/api.ts` — client-side API helpers and auth token handling: uses `localStorage` first, then cookie fallback; `apiCall()` adds `Authorization: Bearer` header and redirects/removes token on 401.
  - `src/app/layout.tsx` — app-level role & subscription gating, dynamic imports with `ssr: false` for components using hooks (example: `SubscriptionBanner`, `Sidebar`), service-worker registration. Respect `"use client"` markers — moving code across client/server boundaries will break behavior.
  - `next.config.ts` — TypeScript & ESLint checks are disabled during build (`ignoreBuildErrors` and `ignoreDuringBuilds`) — changes here affect CI/build tolerance.
  - `scripts/` — DB migrations, quick admin utilities and import/export helpers; run with `npm run <script>` defined in `package.json`.

- **Environment & secrets**:
  - `.env.local` is explicitly read by `src/lib/db.ts`. In production PM2 contexts dotenv may not run, so `db.ts` contains fallback parsing. When adding new env keys, ensure they are available to both Next.js and server-side scripts.
  - Do not leak secrets in logs; `db.ts` masks passwords but may print lengths — keep that in mind when adding debug logs.

- **Auth and tokens**:
  - JWT token flow: stored in `localStorage` and mirrored to cookies in some flows. Client helpers: `setAuthToken`, `getAuthToken`, `removeAuthToken` in `src/lib/api.ts`.
  - API endpoints expect JWT in `Authorization` header. On 401, client helpers remove the token and often redirect to `/login`.

- **Database usage patterns**:
  - Use `query(text, params)` from `src/lib/db.ts` for simple queries; use `transaction(client => ...)` for multi-statement transactions.
  - Connection pool configured with `max: 20`, explicit timeouts, and conditional SSL logic — avoid creating new pools per-request; reuse `getPool()`.

- **Conventions & gotchas**:
  - Many components use React Server Components vs Client Components. Files with `"use client"` at the top are client-only and may use DOM APIs (e.g., `window`, localStorage). Do not call browser APIs from server components.
  - Dynamic imports with `ssr: false` are used for components that depend on client-only hooks (see `src/app/layout.tsx`). Follow that pattern when introducing new client-only UI.
  - Service worker is registered in `src/app/layout.tsx` and `public/sw.js` exists — be careful when changing caching logic.
  - The project retains several migration SQL & helper JS scripts in `scripts/` and `migrations/` — follow existing SQL naming and uniqueness constraints (see `migrations/fix_devices_unique_constraint.sql`).

- **CI / deploy**:
  - GitHub Actions workflows are in `.github/workflows/` and include Firebase + Hetzner deploys. Vercel is also used (`npm run deploy`). If changing build flags (ESLint/TS checks) check workflows first.

- **Debugging & common commands** (examples):
  - Verify DB: `npm run test:db` (calls `test-connection.js`).
  - Run a migration script locally: `npm run migrate:devices` etc. These are Node scripts under `scripts/` and often call SQL files.
  - Start prod with local env: `npm run start:prod` (uses `dotenv -e .env.local -- next start -p 3001`).

- **When editing code, follow these specific rules**:
  - Prefer server-side helpers in `src/lib/` for shared logic (DB, auth, encryption). Avoid duplicating connection logic.
  - When changing `next.config.ts` or build flags, check `.github/workflows/*` to ensure CI remains compatible.
  - If you add server-side environment usage, update any script that runs under PM2 or background contexts to ensure `.env.local` is loaded (see `src/lib/db.ts` parsing behavior).

- **Feedback**: If anything above is unclear or you'd like more examples (e.g., typical API route shape, sample SQL migration), tell me which area to expand and I will iterate.
