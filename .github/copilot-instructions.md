<!-- .github/copilot-instructions.md - Project-specific guidance for AI coding agents -->
# Copilot Instructions

**TL;DR**: Billing/invoicing app (Next.js 15 + TypeScript). App router, JWT auth, Postgres, Firebase Admin, PWA. Dynamic imports for client hooks, centralized DB pool, env loaded twice (Next.js dev + manual PM2 fallback).

## Architecture Overview

- **Full-stack**: Next.js 15 app router with `"use client"` client components. Roles: admin, user. Subscriptions: managed via subscription context.
- **UI** → `src/app/` (routes, components); **API** → `src/app/api/`; **Lib** → `src/lib/` (db, auth, encryption).
- **Backend**: PostgreSQL (pool: `src/lib/db.ts`), Firebase Admin for auth/data, JWT for session.
- **Deployment**: Vercel (primary), Hetzner (backup), with `.github/workflows/` CI/CD.

## Project Commands

```bash
npm run dev                 # Next dev on http://localhost:3000
npm run build              # Next build (ESLint/TS checks disabled in next.config.ts)
npm run start:prod         # PM2-ready: dotenv .env.local → next start -p 3001
npm run lint               # ESLint check
npm run test:db            # Verify Postgres connection
npm run migrate:*          # Run DB migration scripts (datum, devices, display-order, support-chat)
```

## Key Patterns & Files

### Database (`src/lib/db.ts`)
- **Pool**: `getPool()` returns shared `pg.Pool` (max 20 conns, 30s idle timeout, 10s connection timeout).
- **Queries**: `query(text, params)` with automatic logging (duration, row count). On error, logs detail/hint/code.
- **Transactions**: `transaction(client => ...)` handles BEGIN/COMMIT/ROLLBACK.
- **Env loading**: Reads `.env.local` explicitly at startup (lines 6–57). Next.js loads it in dev; PM2 does not, so `db.ts` manually parses. When DATABASE_URL not found, falls back to constructing from `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME`.
- **SSL**: Auto-enabled if `DB_HOST` is NOT `localhost` or `127.0.0.1`.

### Auth & Tokens (`src/lib/api.ts`)
- **Token storage**: `getAuthToken()` checks `localStorage` first, then cookies (sync fallback).
- **Token helpers**: `setAuthToken(token)`, `removeAuthToken()`.
- **API calls**: Helper functions add `Authorization: Bearer <token>` header. On 401, token is removed and user may redirect to `/login`.
- **Current user**: `getCurrentUser()` fetches from `/api/users/me` using stored token.

### App Layout (`src/app/layout.tsx`)
- `"use client"` at top (client component).
- **Contexts**: `AppNameProvider`, `CjenovnikProvider`, `SubscriptionProvider`, `RoleProvider`, `SupportChatProvider`.
- **Dynamic imports** (with `ssr: false`): `SubscriptionBanner`, `Sidebar` — needed because they call `useRole()` / `useSubscription()` hooks.
- **Role gating**: If authenticated and on `/login`, redirect to `/dashboard`. Check role context in `AppContent()`.
- **PWA**: Service worker (`public/sw.js`) registered in useEffect; logs on update.
- **Mobile detection**: In `useEffect`, detect window width ≤ 768px.

### Environment & Configuration
- **`.env.local`**: Required; examples: `DATABASE_URL`, `JWT_SECRET`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME`, `FIREBASE_*`, `NEXT_PUBLIC_*`.
- **`next.config.ts`**: ESLint/TypeScript errors ignored during build (lines 8–13). Safe for fast iteration; don't commit these flags enabled.
- **Scripts**: In `package.json`, `scripts/` and `migrations/` hold Node + SQL helpers. Examples: `migrate-datum-to-text.js`, `fix-devices-unique-constraint.sql`.

## Client/Server Boundaries

- **Client-only APIs**: `localStorage`, `window`, `document.cookie`. Use in `"use client"` files only.
- **Server-only APIs**: DB queries, Firebase Admin, JWT signing. Avoid importing from `src/lib/` (db, firebase, jwt, encryption) into client components — use API routes instead.
- **Dynamic imports**: For components that *must* use hooks (e.g., `useRole()`, `useSubscription()`), import with `dynamic(..., { ssr: false })` in parent layout/component (example: `src/app/layout.tsx` lines 10–11).

## Database & Migrations

- **Migrations** in `scripts/` and `migrations/` are Node.js scripts (`*.js`) or raw SQL (`*.sql`).
- **Running**: `npm run migrate:devices`, `npm run migrate:datum` etc. (defined in `package.json`).
- **Constraints**: Check `migrations/fix_devices_unique_constraint.sql` for pattern. Many scripts construct `.sql` files and run via `pg` pool.
- **Best practice**: Use `transaction()` for multi-table updates; use `query()` for single statements.

## Common Workflows

1. **Add a new API endpoint**:
   - Create `src/app/api/my-endpoint/route.ts` with `export async function GET/POST(req, res)`.
   - Fetch token from Authorization header: `const token = req.headers.get('authorization')?.replace('Bearer ', '')`.
   - Query DB: `const result = await query('SELECT ...', [params])`.
   - Return: `return Response.json({ ... })`.

2. **Add a new client feature**:
   - Create component in `src/app/components/` or route in `src/app/[feature]/`.
   - Add `"use client"` if using hooks; call API helpers from `src/lib/api.ts`.
   - Use context (Role, Subscription) via `useContext()` or hook (if exported from context file).

3. **Add environment variable**:
   - Add to `.env.local`.
   - If server-side script reads it, `src/lib/db.ts` already loads `.env.local` at startup.
   - If Next.js needs it in dev/build, prefix with `NEXT_PUBLIC_` for client-side or ensure `.env.local` exists for server-side.

4. **Debug database**:
   - Run `npm run test:db` to verify connection.
   - Check logs from `src/lib/db.ts` (printed at startup) to see if `.env.local` was loaded.
   - For production PM2, ensure `NODE_ENV=production` and `.env.local` is in cwd.

## Gotchas & Quick Fixes

- **Hooks in server components**: Will error. Use `"use client"` or move to separate file and dynamic-import with `ssr: false`.
- **Token not persisting**: Check if `localStorage` is accessible (dev vs. deployment). `getAuthToken()` falls back to cookies.
- **DB pool exhausted**: Pool max is 20; check for unclosed connections. Use `query()` and `transaction()` helpers, not raw pool calls.
- **PM2 env not loaded**: Manual parsing in `db.ts` (lines 36–50) should catch it; check startup logs for `[db.ts]` output.
- **Build errors hidden**: `next.config.ts` disables ESLint/TS errors in build. Run `npm run lint` separately.

---
*Last updated: Jan 2026. For questions on auth, DB, or migrations, check `src/lib/db.ts`, `src/lib/api.ts`, and `package.json` scripts.*
