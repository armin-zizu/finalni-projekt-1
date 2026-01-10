<!-- .github/copilot-instructions.md - Project-specific guidance for AI coding agents -->
# Copilot instructions (project-specific)

Purpose: concise, actionable context so an AI agent is immediately productive in this Next.js + Postgres app.

## ⚠️ Firebase migracija - KOMPLETAN ODLAZAK

Projekt je u potpunosti migriran sa Firebase-a na Postgres. Svi Firebase fajlovi su obrisani:
- `src/lib/firebase.ts` - OBRISANO
- `src/lib/firestore.js` - OBRISANO  
- `.github/workflows/firebase-hosting-*.yml` - OBRISANO
- `.firebase/` direktorij - OBRISANO
- `.firebaserc` - OBRISANO
- Nema više Firebase dependencija u `package.json`
- Zastarjeli Firebase kod (ako se pojavi) je u komentarima i treba ga ignorisati

Backend je sada 100% Postgres. Sve sekcije koda koja poziva Firebase trebaj trebati da se OBRIŠE ili ispravi.

## Architecture & layout

- **Framework**: Next.js 15 App Router (TypeScript). UI pages under `src/app/`; API routes under `src/app/api/`; shared server helpers in `src/lib/`.
- **Client/server boundary**: Most pages are client components (`"use client"`) due to heavy React Context usage. Root `src/app/layout.tsx` wraps app in 5 providers: RoleProvider, SubscriptionProvider, CjenovnikProvider, AppNameProvider, SupportChatProvider. Components using these contexts must be client-side or dynamically imported with `ssr: false` (see Sidebar, SubscriptionBanner).
- **Build config**: `next.config.ts` intentionally disables TypeScript/ESLint build errors (`ignoreBuildErrors: true`, `ignoreDuringBuilds: true`) and sets `images.unoptimized: true` for simpler deployment.
- **Data flow**: Postgres backend → API routes → client-side `src/lib/api.ts` facade → React components. No direct DB access from client code.

## Run/build/test

- **Dev**: `npm run dev` (port 3000)
- **Build**: `npm run build` 
- **Prod start**: `npm run start` (default) or `npm run start:prod` (loads `.env.local` via dotenv-cli, binds port 3001)
- **DB test**: `npm run test:db` - simple Postgres connectivity check
- **Migrations**: Run via package.json scripts (`migrate:datum`, `migrate:devices`, `migrate:display-order`, `migrate:support-chat`). SQL migration files in `scripts/` and `migrations/` directories.

## Database & environment

- **Connection**: `src/lib/db.ts` explicitly loads `.env.local` for PM2/production (Next.js only auto-loads in dev). On module load, it logs `DATABASE_URL` and `JWT_SECRET` presence (masking values), determines SSL requirements (prod or remote host), and creates a singleton Pool with `max: 20` connections.
- **DB helpers**: Always use `getPool()`, `query(text, params)`, or `transaction(callback)` from `src/lib/db.ts`. Never create new pools.
- **Connection fallback**: Primary: `DATABASE_URL`. Secondary: discrete `DB_USER`, `DB_HOST`, `DB_PORT`, `DB_PASSWORD`, `DB_NAME` vars. SSL auto-enabled when `NODE_ENV=production` or host is not localhost.
- **Required env vars**: `DATABASE_URL` (Postgres connection), `JWT_SECRET` (auth tokens), `NEXT_PUBLIC_ADMIN_EMAIL` (support chat admin, defaults to gitara.zizu@gmail.com).

## Auth & identity model

- **JWT system**: `src/lib/jwt.ts` handles token generation/verification. Module logs loudly if `JWT_SECRET` is missing. Token payload contains `userId` (often email, not UUID).
- **User ID resolution**: Many API handlers accept email or legacy ID as `userId` and resolve to UUID via DB lookup before querying. Example pattern in `src/app/api/users/[userId]/devices/route.ts`:
  ```typescript
  // Check if userId is UUID, if not query DB to resolve
  if (!uuidRegex.test(userId)) {
    const result = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [userId]);
    userId = result.rows[0].id;
  }
  ```
- **Auth middleware**: `src/lib/auth-middleware.ts` exports `withAuth(handler)` and `optionalAuth(handler)`. These attach `req.user` to requests and return 401 on invalid tokens.
- **Client-side auth**: `src/lib/api.ts` stores token in `localStorage`, falls back to cookies. On 401 response, clears token and redirects to `/login`. Token synced from cookie→localStorage on app mount in `layout.tsx`.
- **Route gating**: `src/app/layout.tsx` uses RoleContext and SubscriptionContext to control access. If `role === null`, blocks most routes with approval screen. Subscription state may redirect to `/profile`.

## API route patterns (copy these)

- **Auth routes**: `api/auth/login` queries `users` table by email, validates password with bcrypt (`src/lib/password.ts`), generates JWT, sets non-httpOnly `token` cookie. Also stores `device_id` as HttpOnly cookie when provided for device tracking.
- **Current user**: `api/users/me` (withAuth) resolves email→UUID when needed, returns user fields. PUT/PATCH updates `app_name`.
- **Devices endpoint**: `api/users/[userId]/devices` resolves both path param `userId` AND `req.user.userId` to UUIDs before queries. Allows owner (`isOwner` flag) to manage other users' devices. Upserts on `(user_id, device_id)` unique constraint with fallback to fingerprint hash. **Pattern to replicate**: Always resolve IDs, implement owner bypass, check permissions.
- **File uploads**: `api/files` (withAuth) writes to `public/uploads/<userId>/[obracuni/<datum>/]`, sanitizes filenames, attempts to persist metadata to `file_uploads` table (gracefully degrades if table missing). Deletion tries DB cleanup then filesystem removal.
- **Support chat**: `api/support/messages` auto-creates `support_messages` table with indexes if absent (unless DB user lacks CREATE TABLE permission). `api/support/sse` implements Server-Sent Events via 3-second polling; requires `?token=` query param (EventSource doesn't support custom headers). Admin email from `NEXT_PUBLIC_ADMIN_EMAIL`.
- **Common patterns**: All protected routes use `withAuth()` wrapper. Always resolve non-UUID userIds to UUID before DB queries. Gate cross-user actions with `isOwner` checks (see devices route).

## Client-side architecture

- **API facade**: `src/lib/api.ts` is the single client-side interface for backend calls. Exports helpers: `getAuthToken()`, `setAuthToken()`, `apiCall(endpoint, options)`, device CRUD, file uploads, obracun CRUD. Uses `fetch` with Bearer token; on 401 strips token and navigates to `/login`.
- **Context providers** (5 total in `src/app/context/`):
  - **RoleContext**: Manages user role (vlasnik/konobar/null), device approval state, page permissions. Loads on mount, polls for approval if pending. Critical for route gating.
  - **SubscriptionContext**: Tracks subscription status (active/expired). Triggers redirects to `/profile` when expired.
  - **CjenovnikContext**: Stores price list items, provides CRUD helpers for artikli (products).
  - **AppNameContext**: Stores/updates custom app name per user.
  - **SupportChatContext**: Manages support chat state, unread counts, SSE connection.
- **Hook usage**: Any component using these contexts MUST be client component (`"use client"`) or dynamically imported with `{ ssr: false }`. Example: `Sidebar` and `SubscriptionBanner` are dynamically imported in `layout.tsx`.

## Data model & types

- **Users**: UUID primary key, email (unique), password_hash, app_name, role (vlasnik/konobar/null), is_owner boolean, permissions JSONB.
- **Devices**: Tracks user devices with `(user_id, device_id)` unique constraint. Fields: device_name, device_info JSONB (os, browser, screenSize, ip), role, permissions JSONB, is_blocked, status (active/blocked/pending).
- **Obracuni** (daily reports): Stores `(user_id, datum)` uniquely. `datum` is TEXT format "DD.MM.YYYY". `artikli` is JSONB array containing full article details (naziv, cijena, pocetnoStanje, ulaz, utroseno, krajnjeStanje, etc.). Database schema in `database_schema.sql`.
- **Cjenovnik** (price list): `(user_id, naziv)` unique. Fields: cijena, proizvodna_cijena, zestoko_kolicina.
- **Type definitions**: Not centralized—each page defines its own types (see `src/app/obracun/page.tsx` lines 10-62 for `Artikal`, `Rashod`, `Prihod`, `ArhiviraniObracun` types). Repeat these patterns when creating similar features.

## Uploads & static files

- User uploads live under `public/uploads/<userId>/`; obracun-specific files are nested under `obracuni/<datum>/`. Keep names filesystem-safe; server already sanitizes but avoid adding unicode/whitespace.

## Gotchas & conventions

- **User ID resolution**: User identity may be email OR UUID string. Always resolve to UUID before DB queries using pattern: check with uuidRegex, query `users` table by email/id to get UUID. Gate cross-user actions with `isOwner` boolean checks.
- **Service worker**: PWA mode enabled by default via `public/sw.js`. Registration happens in `layout.tsx` on mount. Don't break this; if adjusting cache strategy, update both files in sync.
- **DB connection**: Never create new Pool instances. Always import and use `getPool()`, `query()`, `transaction()` from `src/lib/db.ts`. The singleton pool is configured with SSL detection and proper timeouts.
- **Type definitions**: Types are duplicated across pages (not centralized). When adding features, look at similar pages (e.g., `obracun/page.tsx`, `profit/page.tsx`) and replicate their type patterns.
- **Error handling**: DB errors log comprehensive details (code, detail, hint) via `src/lib/db.ts`. API routes should return appropriate HTTP status codes (401 unauthorized, 403 forbidden, 404 not found, 500 server error).
