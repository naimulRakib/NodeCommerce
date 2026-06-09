# Audit & Bug Fix Tasks

- `[x]` Fix Configuration & Types
  - `[x]` Fix `test-local-resellers.ts` Prisma import
  - `[x]` Fix `src/lib/realtime-notifier.ts` Prisma import
  - `[x]` Fix `scripts/hackathon-verify.ts` invalid property
- `[x]` Fix API Routes
  - `[x]` Fix `src/app/api/aco/negotiate/route.ts` auth import
  - `[x]` Fix `src/app/api/aco/phase4-trigger/route.ts` invalid select properties
- `[x]` Fix UI Components
  - `[x]` Fix `src/components/district-reseller/DistrictStockOverview.tsx` missing import
  - `[x]` Fix `src/components/local-reseller/InventoryTable.tsx` VirtualList props
  - `[x]` Fix `src/components/seller/dashboard/ProfileSection.tsx` NodeJS.Timeout type
  - `[x]` Fix `src/components/superdashboard/MapClient.tsx` invalid property access
- `[x]` Verification
  - `[x]` Run `npx tsc --noEmit` to confirm success
