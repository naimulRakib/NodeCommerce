# Full System Audit & Workflow Polish Plan

## Goal Description
Conduct a sweeping audit of the current application, fix all TypeScript compilation errors, correct invalid Prisma client imports, repair missing API endpoints, and ensure all user-facing UI workflows (like District Inventory and Negotiations) run flawlessly without crashing or needing manual developer intervention.

## User Review Required
Please review the proposed bug fixes below. This will stabilize the codebase and ensure the supply chain app can run totally autonomously.

## Open Questions
- Do you want to keep the auto-triggering behavior strictly via cron jobs in the future, or are you happy with the "Trigger Global ACO" button for demo purposes? (We will ensure the button works perfectly regardless).

## Proposed Changes

### Configuration & Types
Fixing the core imports to match our custom Prisma generation and fixing React hooks.

#### [MODIFY] [test-local-resellers.ts](file:///Users/naimulislam/Desktop/Lightborn/NodeCommerce/nodecom/test-local-resellers.ts)
- Update import from `@prisma/client` to `@/lib/prisma`.

#### [MODIFY] [realtime-notifier.ts](file:///Users/naimulislam/Desktop/Lightborn/NodeCommerce/nodecom/src/lib/realtime-notifier.ts)
- Update import from `@prisma/client` to use the schema types generated in our custom output directory.

#### [MODIFY] [hackathon-verify.ts](file:///Users/naimulislam/Desktop/Lightborn/NodeCommerce/nodecom/scripts/hackathon-verify.ts)
- Remove invalid `productCode` reference from the `SellerSupplySnapshot` type map.

### API Routes
Fixing backend logic crashes before they happen.

#### [MODIFY] [negotiate/route.ts](file:///Users/naimulislam/Desktop/Lightborn/NodeCommerce/nodecom/src/app/api/aco/negotiate/route.ts)
- Fix broken import: Change `@/lib/auth` to `@/lib/auth-utils`.

#### [MODIFY] [phase4-trigger/route.ts](file:///Users/naimulislam/Desktop/Lightborn/NodeCommerce/nodecom/src/app/api/aco/phase4-trigger/route.ts)
- Remove `lat` and `lng` from the `DistrictReseller` select statement, as these coordinates exist on the Upazilla/Local layers but not on the generic District account in our schema.

### UI Components
Fixing visual bugs and React crashes.

#### [MODIFY] [DistrictStockOverview.tsx](file:///Users/naimulislam/Desktop/Lightborn/NodeCommerce/nodecom/src/components/district-reseller/DistrictStockOverview.tsx)
- Add missing `import { useCallback }` to prevent React from crashing when rendering the district stock.

#### [MODIFY] [InventoryTable.tsx](file:///Users/naimulislam/Desktop/Lightborn/NodeCommerce/nodecom/src/components/local-reseller/InventoryTable.tsx)
- Fix the `VirtualList` component throwing missing `rowProps` errors by supplying the correct DOM properties or stripping invalid ones.

#### [MODIFY] [ProfileSection.tsx](file:///Users/naimulislam/Desktop/Lightborn/NodeCommerce/nodecom/src/components/seller/dashboard/ProfileSection.tsx)
- Fix the `NodeJS.Timeout` strict mode error to cleanly support browser-based `setTimeout`.

#### [MODIFY] [MapClient.tsx](file:///Users/naimulislam/Desktop/Lightborn/NodeCommerce/nodecom/src/components/superdashboard/MapClient.tsx)
- Fix invalid property access on the visibility toggles that was causing mapping errors.

## Verification Plan

### Automated Tests
- Run `npx tsc --noEmit` and confirm 0 errors.
- Run the build sequence `npm run build` to guarantee it is production-ready.

### Manual Verification
- Render the `DistrictStockOverview` and `InventoryTable` components in the browser to ensure no React runtime crashes occur.
- Verify that Phase 4 routing works after approvals by running a manual trace on the API.
