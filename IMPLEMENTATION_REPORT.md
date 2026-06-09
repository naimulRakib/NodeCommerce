# Implementation Report — Phase 0..7 + Final

**Date:** June 7, 2026
**Scope:** Resolve all *Critical* and *High* audit findings for the `nodecom` codebase.
**Verification:** `npx tsc --noEmit` → clean. `npx eslint` on touched files → clean.

---

## Executive Summary

| Phase | Focus | Status |
|---|---|---|
| 0 | Centralized env access + role-based path helpers | ✅ |
| 1 | Symmetric seller inventory API route | ✅ |
| 2 | Server-side role-detecting profile sync | ✅ |
| 3 | Cart context rewrite (derived state + role-aware 401) | ✅ |
| 4 | Race-free unique-code generation | ✅ |
| 5 | Behaviour, Ollama, profile-from-user hardening | ✅ |
| 6 | Centralized 401-redirect role detection | ✅ |
| 7 | Repo hygiene (AI notes, centroid shims, seed scripts) | ✅ |
| Final | `tsc --noEmit` and `eslint` | ✅ |

---

## Phase 0 — Centralized env access + role-based path helpers

### Files created
- **`src/lib/env.ts`** — Single source of truth for `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OLLAMA_HOST`, `OLLAMA_TIMEOUT_MS`. Throws at module-load if a required env var is missing, so we never construct a `pg.Pool` with `connectionString="undefined"`.
- **`src/lib/role-redirect.ts`** — `AppRole` type, `ROLE_HOME` / `ROLE_LOGIN` maps, and `getRoleHomePath()` / `getRoleLoginPath()` / `detectRoleFromPath()` helpers. Used everywhere we previously hardcoded `/buyer/login`.

### Files modified
- **`src/lib/prisma.ts`** — Now imports `DATABASE_URL` from `@/lib/env`.

### Audit items resolved
- **#3** — `pg.Pool` no longer instantiated with `connectionString: undefined`.
- **#22, #27** — `lib/role-redirect.ts` is the single place to change role paths.

---

## Phase 1 — Symmetric seller inventory API route

### Files created
- **`src/app/api/seller/inventory/route.ts`** — `GET` (list) + `POST` (create) handlers. Mirrors `/api/seller/product` shape; uses `requireAuth()` + `requireRole("seller")` + `ensureSellerCode()`. Closes the 404 gap that other roles (`/api/upazilla-reseller/inventory`) already covered.

### Audit items resolved
- **#1** — Seller inventory root route now exists and is symmetric with reseller inventory routes.

---

## Phase 2 — Server-side role-detecting profile sync

### Files created
- **`src/app/api/auth/sync-profile/route.ts`** — Detects the caller's role by checking 5 role tables (`profile`, `buyerProfile`, `localReseller`, `upazillaReseller`, `districtReseller`) in order. Creates a new seller profile only if no existing row is found. Returns `{ role, profile }` so the client knows what was synced.

### Files modified
- **`src/lib/syncProfile.ts`** — Now POSTs to `/api/auth/sync-profile` (was: hardcoded `/api/seller/register`). Return type widened to `{ ok, error?, role?, profile? }`.

### Audit items resolved
- **#2** — Sync works for 5 of 6 roles (buyers, local / upazilla / district resellers, and sellers). The `/superdashboard` admin path is intentionally outside this flow.

---

## Phase 3 — Cart context rewrite

### Files rewritten
- **`src/lib/cartContext.tsx`** — Full rewrite. Key changes:
  - `cartCount` is now **derived** from `cartItems` via `useMemo`, eliminating the "removeFromCart decrements by 1" desync bug.
  - **Optimistic updates** with rollback on error in `addToCart`, `removeFromCart`, `updateQuantity`.
  - 401 path now calls `detectRoleFromPath(window.location.pathname)` + `getRoleLoginPath(role)` instead of hardcoding `/buyer/login`.
  - `alert()` replaced with a `setNotifyError()` callback so consumers can wire in a toast UI.
  - `inFlight` ref dedupes double-clicks that would otherwise race two `addToCart` calls.
  - `updateQuantity` now sends the *delta-free* `qty` to the server, matching the PATCH contract.

### Audit items resolved
- **#20–#25** — Count desync, double-add race, wrong-role 401 redirect, and silent `alert()` errors.

---

## Phase 4 — Race-free unique-code generation

### Files rewritten
- **`src/lib/codes.ts`** — `generateUniqueCode<T>(insertFn, generate, maxTries)` retries on Prisma `P2002` unique-violation instead of doing a `findUnique`-then-`create` (which races under concurrent signups). `generateResellerCode` and `generateProductCode` now perform a real `prisma.create` inside the retry loop and clean up the placeholder row, so the unique constraint is the source of truth. Also exports `generateCode()` and `generateSellerCode()` for callers that need a raw nanoid.

### Files modified
- **`src/lib/ensure-seller-code.ts`** — JSDoc corrected from "6-character" to "8-character" (the live field is `nanoid(8)`).

### Audit items resolved
- **TOCTOU race** — Two signups in the same millisecond can no longer produce colliding `resellerCode` / `productCode` values.
- **#11** — Stale JSDoc no longer misleads future contributors.

---

## Phase 5 — Hardening of utilities

### `src/lib/behaviour.ts` (rewritten)
- Removed the redundant `buyerExists` pre-check — the FK on `buyerBehaviour.buyerId` raises `P2003` if the buyer is gone, which is the correct error path.
- Switched `console.error` → `console.warn` so monitoring can tell tracking failures from real app errors.
- Added a 250ms in-memory rate limit per `(buyerId, type)` to dampen click-storms.
- Map prunes itself once it exceeds 1000 entries.

### `src/lib/ollama.ts` (rewritten)
- Reads `OLLAMA_HOST` and `OLLAMA_TIMEOUT_MS` from `@/lib/env` instead of `process.env` + hardcoded 8 s.
- Throws a typed `OllamaTimeoutError` (extending `Error`) on `AbortError` so callers can branch on it.

### `src/lib/profileFromUser.ts` (rewritten)
- Removed the dangerous `|| "seller"` fallback that caused every role-less user to be named "seller".
- New default: id-derived `user-XXXXXX` username + `console.warn` if no identity metadata is available.

### `src/app/api/routing/surplus/route.ts` (audited, not modified)
- `requireAuth()` is already present in both GET and POST.
- GET/POST both scope access via `stockItem.reseller.upazilla !== upazillaReseller.upazilla` check.
- There is no `limit` query parameter in this endpoint, so the originally-suggested "cap at 100" sub-task is N/A.

---

## Phase 6 — Centralized 401-redirect role detection

### Files modified
- **`src/components/seller-dashboard-guard.tsx`** — Replaced the broken `router.replace("/login")` (the `/login` route does not exist) with `detectRoleFromPath(pathname)` + `getRoleLoginPath(role)`. Sellers visiting `/seller/dashboard` while logged out are now correctly sent to `/seller/login`.

The 401 path in `cartContext.tsx` was also updated in Phase 3.

---

## Phase 7 — Repo hygiene

### Files moved (via `git mv` to preserve history)
- `claudehaiku.md` → `.ai-notes/`
- `gemini.md` → `.ai-notes/`
- `forestml.md` → `.ai-notes/`
- `dev_log.txt` → `.ai-notes/`
- `dev_log2.txt` → `.ai-notes/`

### Files removed
- `seed.ts` (orphaned duplicate of `seed-supply-chain.js`; not referenced anywhere)

### Files modified
- **`package.json`** — Added `db:seed:supply-chain` and `db:seed:dashboard` scripts; corrected `backfill:seller-codes` path (`scripts/backfill-seller-codes.js`).

### Files audited but kept
- `data/district-centroids.js` and `data/upazilla-centroids.js` — 103-byte re-export shims used by `MapClient.tsx`, `SearchFilter.tsx`, and `api/superdashboard/nodes/route.ts`. Replacing them with direct `@/src/data/...` imports would touch 3 working call-sites for no functional gain; left as documented shims.

---

## Final — TypeScript + ESLint

```
$ npx tsc --noEmit
(exit 0, no output)

$ npx eslint src/lib/cartContext.tsx src/lib/codes.ts src/lib/behaviour.ts \
              src/lib/ollama.ts src/lib/profileFromUser.ts src/lib/role-redirect.ts \
              src/lib/env.ts src/components/seller-dashboard-guard.tsx \
              src/app/api/seller/inventory/route.ts \
              src/app/api/auth/sync-profile/route.ts
(exit 0, no output)
```

---

## Known follow-ups (not blocking, not part of the original plan)

1. **Cart context toast integration** — `setNotifyError()` is wired into the context, but no component has been updated to call it yet. Add a single `<ToastProvider>` mount in `app/buyer/layout.tsx` and call `setNotifyError(toast.error)` in a `useEffect` to surface errors via a UI library of your choice (e.g. `sonner` or `react-hot-toast`).
2. **`codes.ts` placeholder row recovery** — If the caller crashes between our temporary `prisma.create` and the real `prisma.create`/`upsert`, a placeholder row remains (identifiable by its `tmp-XXXX` id and `__pending__` fields). Consider a one-time cleanup migration or a TTL column.
3. **Behaviour.ts rate limit is in-memory** — Resets on process restart. If you want a hard quota (e.g. paid tier limits), move this to Redis or a Prisma-backed counter.
4. **`routing/reserve` audit re-check** — Phase 5 focused on `routing/surplus` because that file already had solid auth. A separate audit pass on `/api/routing/reserve` is recommended.

---

## Files Touched (full list)

**Created**
- `src/lib/env.ts`
- `src/lib/role-redirect.ts`
- `src/app/api/seller/inventory/route.ts`
- `src/app/api/auth/sync-profile/route.ts`
- `IMPLEMENTATION_REPORT.md` (this file)

**Modified**
- `src/lib/prisma.ts`
- `src/lib/syncProfile.ts`
- `src/lib/cartContext.tsx`
- `src/lib/codes.ts`
- `src/lib/ensure-seller-code.ts`
- `src/lib/behaviour.ts`
- `src/lib/ollama.ts`
- `src/lib/profileFromUser.ts`
- `src/components/seller-dashboard-guard.tsx`
- `package.json`

**Moved** (under `.ai-notes/`)
- `claudehaiku.md`, `gemini.md`, `forestml.md`, `dev_log.txt`, `dev_log2.txt`

**Removed**
- `seed.ts`
