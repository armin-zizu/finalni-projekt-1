<!-- .github/copilot-instructions.md - Project-specific guidance for AI coding agents -->
# Copilot instructions (project-specific)

Concise context so an AI is productive fast in this Next.js + Postgres app. Firebase is fully removed; any Firebase code or deps is dead and should be deleted/ignored.

## Stack & layout
- Next.js 15 App Router (TypeScript). UI pages under src/app; API routes under src/app/api; shared server helpers in src/lib.
- Most pages are client components because of heavy context use. src/app/layout.tsx wraps 5 providers (Role, Subscription, Cjenovnik, AppName, SupportChat). Components using these contexts must be client-side or dynamically imported with ssr: false (e.g., Sidebar, SubscriptionBanner).
- Build config in next.config.ts ignores TS/ESLint errors and sets images.unoptimized: true.
- Data path: Postgres → API routes → client facade src/lib/api.ts → React components. No direct DB access from client code.

## Run / ship
- Dev: npm run dev (3000). Build: npm run build. Prod start: npm run start (or npm run start:prod to load .env.local, port 3001).
- DB check: npm run test:db.
- Migrations via scripts in package.json (migrate:datum, migrate:devices, migrate:display-order, migrate:support-chat); SQL lives in scripts/ and migrations/.
- Prod deploy/restart pattern: cd ~/bar-app && git pull origin main && npm run build && pm2 restart office-app --update-env (see QUICK_SERVER_COMMANDS.md).

## Database & env
- src/lib/db.ts loads .env.local manually on import for PM2/production, logs presence of DATABASE_URL/JWT_SECRET, auto-enables SSL in prod/remote, and builds a singleton Pool max 20.
- Always use getPool(), query(text, params), or transaction(callback) from src/lib/db.ts; never create new pools.
- Env fallback: DATABASE_URL preferred; else DB_USER/DB_HOST/DB_PORT/DB_PASSWORD/DB_NAME. Required vars: DATABASE_URL, JWT_SECRET, NEXT_PUBLIC_ADMIN_EMAIL (defaults to gitara.zizu@gmail.com).

## Auth & identity
- JWT helpers in src/lib/jwt.ts; payload userId may be email or UUID. Missing JWT_SECRET logs loudly.
- Middleware: src/lib/auth-middleware.ts exports withAuth/optionalAuth to attach req.user or return 401.
- Client auth: src/lib/api.ts stores token in localStorage (fallback cookies); on 401 clears token and redirects to /login. layout.tsx syncs cookie→localStorage on mount.
- User identity resolution is critical: route params and req.user.userId may be email or UUID—resolve both to UUID before DB queries; gate cross-user actions with isOwner (pattern in src/app/api/users/[userId]/devices/route.ts).

## API route patterns
- auth/login: query users by email, bcrypt check (src/lib/password.ts), issue JWT, set non-httpOnly token cookie; device_id stored as HttpOnly cookie when provided.
- users/me: withAuth; resolves email→UUID; PUT/PATCH updates app_name.
- users/[userId]/devices: resolves both requester and path IDs to UUID, allows owner bypass, upserts on (user_id, device_id) with fallback fingerprint hash.
- files: withAuth; writes to public/uploads/<userId>/[obracuni/<datum>/], sanitizes names, tries file_uploads table but degrades gracefully; delete tries DB then filesystem.
- support/messages: auto-creates support_messages table + indexes if missing (unless perms block). support/sse uses 3s polling SSE and requires ?token= query param (EventSource has no headers). Admin email from NEXT_PUBLIC_ADMIN_EMAIL.

## Client patterns
- src/lib/api.ts is the single fetch facade (apiCall + helpers for devices/files/obracuni); handles Bearer token + 401 redirect.
- Contexts in src/app/context/: Role (role, approvals), Subscription (active/expired with redirects), Cjenovnik (artikli CRUD), AppName (branding), SupportChat (state, unread, SSE token handling). Components using useContext directly should guard: const role = useContext(RoleContext)?.role ?? null.
- Types are duplicated per page (e.g., Artikal/Rashod/Prihod/ArhiviraniObracun near top of src/app/obracun/page.tsx); mirror patterns locally rather than centralizing.

## Data model (DB)
- users: id UUID, email unique, password_hash, app_name, role vlasnik/konobar/null, is_owner bool, permissions JSONB.
- devices: unique (user_id, device_id); device_name, device_info JSONB (os, browser, screenSize, ip), role, permissions JSONB, is_blocked, status active/blocked/pending.
- obracuni: unique (user_id, datum TEXT "DD.MM.YYYY"); artikli JSONB array with full article detail.
- cjenovnik: unique (user_id, naziv); fields cijena, proizvodna_cijena, zestoko_kolicina.

## Files, PWA, gotchas
- Uploads live in public/uploads/<userId>/ with obracuni/<datum>/ subfolders; keep filenames filesystem-safe (server sanitizes but avoid unicode/whitespace).
- PWA/service worker: public/sw.js plus registration in layout.tsx—update both together if caching changes.
- Date handling: obracuni use TEXT "DD.MM.YYYY"; never convert to DATE type in queries.
- DB errors are verbose via src/lib/db.ts (code/detail/hint); return proper HTTP statuses (401/403/404/500) in routes.

Ask for clarification if a pattern seems ambiguous or missing.
