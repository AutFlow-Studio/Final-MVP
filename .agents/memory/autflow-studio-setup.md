---
name: AutFlow Studio Setup
description: Full-stack agency OS — key decisions, bootstrap facts, and env quirks worth remembering across sessions.
---

## Stack
- **Frontend**: React + Vite + Tailwind, `artifacts/autflow-studio/`
- **API**: Express 5, `artifacts/api-server/`
- **DB**: Drizzle ORM + PostgreSQL, `lib/db/`
- **Codegen pipeline**: OpenAPI → Zod → React Query in `lib/api-zod/` and `lib/api-client-react/`

## Auth Architecture
- Server-side sessions via `express-session` + `connect-pg-simple` (PostgreSQL session store)
- bcryptjs for password hashing (never JWT)
- Cookie name: `autflow.sid`; `httpOnly: true`, `sameSite: lax`, `secure` only in production
- Session data: `{ userId, userRole, userName, userEmail }` in `artifacts/api-server/src/types/session.d.ts`
- Middleware: `requireAuth` (401 if no session), `requireOwner` (403 if not owner)
- Auth routes: `/api/auth/login|logout|me|register|password|profile`
- Settings route: `/api/settings/agency` (singleton pattern)
- Default admin: `admin@autflow.io` / `admin123`

## DB Tables (outside Drizzle codegen)
- `users` — id, name, email, password_hash, role, created_at, last_login_at
- `agency_settings` — singleton agency profile + notification prefs + invoice config
- `sessions` — connect-pg-simple sessions table (standard schema)

**All three are created by `pnpm --filter @workspace/scripts run migrate`.**
Run migrate before seed. Seed does NOT truncate users.

## Critical esbuild Quirks

**connect-pg-simple `createTableIfMissing: true` is BROKEN with esbuild bundling.**
The package looks for `table.sql` next to the module file at runtime, but esbuild bundles into `dist/` and strips that asset. Always create the sessions table via `migrate.ts` and do NOT use `createTableIfMissing: true`.

**`.d.ts` files must NOT be `import`ed.** TypeScript declaration files (like `src/types/session.d.ts`) are picked up automatically through `tsconfig.json`'s `include: ["src"]`. Adding `import "./types/session"` causes an esbuild build error ("Could not resolve").

## Route Protection
All private routes sit behind `requireAuth` in `artifacts/api-server/src/routes/index.ts`.
Public routes: `/api/health`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`.
Owner-only: `/api/admin/reset`, `/api/auth/register`.

## Frontend Auth
- `AuthProvider` in `artifacts/autflow-studio/src/components/auth-provider.tsx` — fetches `/api/auth/me` on mount; exposes `{ user, loading, login(), logout() }`.
- `App.tsx` wraps everything in `<AuthProvider>` + `<ErrorBoundary>` and renders an `AuthGate` that shows spinner → login page → app.
- All fetch calls must include `credentials: "include"` to send the session cookie.
- Generated React Query hooks in `lib/api-client-react` do NOT set `credentials: "include"` by default — check `custom-fetch.ts` if those hooks return 401 after auth is active.

## Settings Persistence
- Agency profile, notification prefs, invoice config → `agency_settings` table via `/api/settings/agency`
- User name/email → `/api/auth/profile` (PATCH)
- Password → `/api/auth/password` (PATCH)
- Theme (dark/light/system) → localStorage only
- `AgencyProfileProvider` fetches from API on mount; includes one-time localStorage→API migration

## PDF Invoicing
- Client-side using `jsPDF` (installed in frontend)
- Function `downloadInvoicePDF(payment, agencyName, agencyEmail, website)` in `artifacts/autflow-studio/src/pages/payments/index.tsx`
- Replaced the old TXT download

## Error Handling
- Express 5 auto-forwards async rejections to error middleware (no `asyncHandler` wrapper needed)
- Global error handler in `app.ts` — guards with `if (res.headersSent) return` to avoid "headers already sent" crash
- Process-level `uncaughtException`/`unhandledRejection`/`SIGTERM` handlers in `index.ts`
- React `ErrorBoundary` wraps the app in `App.tsx`

## Artifact Registration (Critical)
Artifacts imported from GitHub are NOT automatically registered in Replit's preview system even if `artifact.toml` files exist. `listArtifacts()` returns `[]` until they are re-registered. To re-register: back up the source, delete the artifact directory, call `createArtifact()`, then restore the source code. The artifact system then injects PORT and BASE_PATH automatically into managed workflow commands — do NOT manually set these in the workflow command.

## API Proxy (Vite)
Since the api-server artifact (kind="api") can't be created via `createArtifact`, `/api` calls are proxied through Vite's `server.proxy` in `artifacts/autflow-studio/vite.config.ts` → `http://localhost:8080`. This replaces the need for a second artifact path registered in the Replit proxy.

## drizzle-kit push Requires TTY
`drizzle-kit push` (and `push-force`) fail in non-interactive shells with "Interactive prompts require a TTY terminal". On a fresh DB, create Drizzle-managed tables via `executeSql()` using raw SQL matching the schema definitions in `lib/db/src/schema/`. The `scripts/src/migrate.ts` only handles users, agency_settings, and sessions — the rest (clients, projects, etc.) must be created separately.

## Object Storage (GCS — Document Vault)
- Bucket: `replit-objstore-c8bffa7f-292a-4160-a7e4-647351d03c6a` (provisioned, secrets set)
- Server files: `artifacts/api-server/src/lib/objectStorage.ts` + `objectAcl.ts` (copied from skill templates)
- Routes: `artifacts/api-server/src/routes/storage.ts` — mounted after `requireAuth` in routes/index.ts
  - `POST /api/storage/uploads/request-url` — presigned URL; validated by session auth only (no api-zod import)
  - `GET /api/storage/objects/*path` — streams private objects; images/PDFs inline, others as attachment
- File-backed documents: `url` field stores `objectPath` (e.g. `/objects/uploads/<uuid>`). Detect with `url.startsWith("/objects/")`. Serve URL: `/api/storage` + objectPath.
- On document delete: GCS object is cleaned up fire-and-forget in `documents.ts`
- **No Uppy / object-storage-web package**: upload flow implemented inline in the frontend with plain `fetch` (no extra deps needed)

## Run Order for Fresh Setup
1. Create all tables via `executeSql` (or `pnpm --filter @workspace/scripts run migrate` for the 3 manual tables)
2. Create sessions table manually if missing (connect-pg-simple standard schema — see sessions section above)
3. `pnpm --filter @workspace/scripts run seed` — demo data + default admin user
4. Artifact workflows start automatically once registered
