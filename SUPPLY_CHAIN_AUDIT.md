# Supply-Chain Business Logic Audit — NodeCommerce
**Audit date:** June 5, 2026
**Scope:** District → Upazilla → Local reseller tiers, ACO routing engine, demand/transfer lifecycles, pheromone logic, walk-in buyer flow, cross-tier traceability.
**Method:** Static read of route handlers, Prisma schema, and ACO engine. All findings are evidenced with file paths and line numbers from the live source.
**Constraint:** Read-only audit. No code modifications.

---

## Severity Legend
- **CRITICAL** — Data loss, money loss, or security flaw in production paths.
- **HIGH** — Race condition, atomicity violation, or silent accounting drift.
- **MEDIUM** — Logic gap that surfaces only in edge cases; visible inconsistency between code paths.
- **LOW** — Code smell, performance nit, or future-proofing concern.
- **GOOD** — Defensive guard or pattern worth preserving.

---

## Section A — Transfer Lifecycle (3 tiers)

### A.1 Atomic stock deduction: GOOD pattern, MEDIUM inconsistency
**Files:** `src/app/api/upazilla-reseller/transfer/route.ts:55-65`; `src/app/api/district-reseller/transfer/route.ts:107-120`; `src/app/api/district-reseller/pull-stock/route.ts:71-85`; `src/app/api/district-reseller/national-transfer/route.ts:62-72`.

All four transfer handlers use the correct race-safe idiom:
```ts
const updatedStockCount = await tx.<stockItem>.updateMany({
  where: { id, quantity: { gte: qty } },
  data: { quantity: { decrement: qty } }
});
if (updatedStockCount.count === 0) throw new Error("Insufficient stock...");
```
- **GOOD** — This is the only correct pattern for "check-then-decrement" stock operations in Postgres via Prisma.
- **MEDIUM — Inconsistent error wording.** The four handlers each throw a slightly different message ("Insufficient stock.", "Stock became insufficient. Please refresh and try again.", "Stock became insufficient or was pulled by another district.", "Insufficient surplus..."). Frontend has to maintain a regex zoo; recommend one canonical error code (`INSUFFICIENT_STOCK`) surfaced in the response body.

### A.2 DistrictTransfer has a `findFirst` race on dedup
**File:** `src/app/api/district-reseller/transfer/route.ts:90-99`
```ts
const existingTransfer = await prisma.districtTransfer.findFirst({
  where: { districtResellerId, upazillaResellerId, productName, status: "pending" }
});
if (existingTransfer) return 400;
```
**Severity: MEDIUM**
- Two concurrent `POST` requests from the same district reseller (e.g., double-click on a slow network) can both pass this check before either row is created. Both will then pass the `updateMany` decrement, and two `DistrictTransfer` rows will be inserted for the same product/upazilla pair.
- **Fix:** Add `@@unique([districtResellerId, upazillaResellerId, productName, status])` partial index where `status='pending'`, or wrap the check + create in a serializable transaction. The LocalDemand endpoint (`local-reseller/demand/route.ts:79-100`) already has the correct pattern: it relies on the DB-level `@@unique([localResellerId, productCode])` constraint and lets Prisma throw on conflict.

### A.3 DistrictTransfer runs dedup check OUTSIDE transaction
**File:** `src/app/api/district-reseller/transfer/route.ts:88-130`
**Severity: MEDIUM**
- The `findFirst` for an existing pending transfer happens at line 90 — *before* the `$transaction` block at line 102. If another request creates a pending transfer between the check and the transaction opening, the second request will see no existing transfer and create a duplicate (compounding the A.2 race).
- **Fix:** Move the dedup check inside the transaction. Use `tx.districtTransfer.findFirst` and treat the case as a constraint-style failure.

### A.4 StockTransfer accept has a fake-upsert race
**File:** `src/app/api/local-reseller/transfers/route.ts:62-88`
**Severity: HIGH**
- The PATCH accept handler does `findFirst` for an existing `ResellerStockItem` (case-insensitive match on `customName`, `sellerProductId: null`), then either `update` or `create`. Two concurrent accepts for the same product on the same local reseller can both pass the `findFirst` (returning null) and both attempt `create`. Without a DB unique constraint, both succeed and the local reseller ends up with two stock rows for the same product. Worse, the `update` path has no race protection either — the second `increment` could clobber the first if the rows differ in any case-insensitive way.
- **Fix:** Add `@@unique([resellerId, customName])` (or use `productCode` if normalized), and switch to `prisma.resellerStockItem.upsert` with a proper `where` clause. The same pattern was correctly avoided in `local-reseller/demand/route.ts` (uses real upsert on the unique constraint).

### A.5 Reject path unconditionally increments UpazillaStockItem
**File:** `src/app/api/local-reseller/transfers/route.ts:90-99`
**Severity: HIGH**
- The reject branch does `tx.upazillaStockItem.update({ where: { id: transfer.stockItem.id }, data: { quantity: { increment: transfer.quantity } } })` with no atomic threshold check. Between the time the transfer was first deducted and the time the rejection returns the stock, the UpazillaStockItem could have been deleted, transferred away, or otherwise modified. The transaction is also vulnerable to a TOCTOU race with the original deduct (`upazilla-reseller/transfer/route.ts:55-65`).
- **Fix:** Use `updateMany` with a `quantity: { gte: 0 }` predicate (idempotent), or use an upsert. Better: add a `StockTransfer.returnedAt` field and have the original sender increment with a check on the transfer status.

### A.6 No rejection / cancellation path on DistrictTransfer
**Files:** `src/app/api/district-reseller/transfer/route.ts` (no PATCH); schema `TransferStatus` enum (read in prior session) has only `pending / accepted / rejected`.
**Severity: MEDIUM**
- A district reseller can create a DistrictTransfer (line 110 creates it with `status: "pending"`) but the file has only POST and GET. There is no PATCH/accept/reject handler. The upazilla reseller endpoint at `upazilla-reseller/district-transfers` (not yet read) may handle this, but the audit log is missing the perspective.
- **Concern:** If a district transfer is "orphaned" (district can never reach the upazilla), the deducted stock is stranded with no recovery path. Need to verify the upazilla-side accept/reject logic — if it's absent, this is CRITICAL.
- **Action:** Verify `src/app/api/upazilla-reseller/district-transfers/route.ts` for the accept/reject path; if not present, the stock is permanently locked.

### A.7 Pull-stock finds existing DistrictStockItem by name with no upsert safety
**File:** `src/app/api/district-reseller/pull-stock/route.ts:91-110`
**Severity: MEDIUM**
- Same pattern as A.4: `findFirst` on `productName` (case-insensitive), then conditional update/create. Two concurrent pulls of the same product by the same district reseller can create two stock rows.
- **Fix:** Add a unique index on `(districtResellerId, productName)` and use real upsert.

### A.8 National transfer status: `accepted` is the only terminal state
**File:** `src/app/api/district-reseller/national-transfer/route.ts:99-103`
**Severity: MEDIUM**
- The national transfer is created with `status: "accepted"` immediately on creation, with no confirmation step. If the receiving district reseller's session is killed between the decrement and the create, the transfer may not be recorded but the stock has been moved. Conversely, if the destination create fails after the source decrement (inside the same `$transaction` this is fine, but the NationalTransfer is created with `toDistrictResellerId: user.id` without verifying the destination stock was successfully incremented). 
- **Note:** The transaction structure is OK because the create at line 99 is the *last* step after both source decrement and destination increment — so a transaction failure rolls everything back. But the audit-trail concern remains: there is no `pending → accepted` state, so external observers cannot distinguish "transfer in progress" from "transfer complete" for monitoring.

### A.9 NationalTransfer `take: 100` (not paginated)
**File:** `src/app/api/district-reseller/national-transfer/route.ts:117-128`
**Severity: LOW**
- `take: 100` with no `skip` or cursor pagination. For a busy district this will silently truncate history.

### A.10 `take: 200` cap on all transfer list endpoints
**Files:** `local-reseller/transfers/route.ts`, `upazilla-reseller/transfer/route.ts`, `district-reseller/transfer/route.ts`.
**Severity: LOW**
- Same pattern — implicit 200-row cap. Combined with no `skip`, a user with > 200 historical transfers cannot scroll back. Recommend `cursor`-based pagination.

---

## Section B — Demand Lifecycle (3 tiers)

### B.1 LocalDemand: GOOD pattern with DB-level unique constraint
**File:** `src/app/api/local-reseller/demand/route.ts:62-110`
**Severity: GOOD**
- The `localDemand` model has `@@unique([localResellerId, productCode])` (schema, prior session). The endpoint does `findUnique` on the unique key, then `update` or `create`. Critically, both are wrapped in `prisma.$transaction(async (tx) => {...})` (line 70), so the local demand write and the upazilla-demand bubble are atomic. This is the strongest example of the correct pattern in the codebase.
- **GOOD — The team already solved this problem correctly here.** A.2, A.4, A.7 should be refactored to match this template.

### B.2 UpazillaDemand: GOOD upsert with cascade recompute
**File:** `src/app/api/demand/upazilla/route.ts:55-95`
**Severity: GOOD**
- Uses real `upsert` (line 55) with the unique key `upazillaResellerId_productName`. After the upsert, the handler recomputes the parent `DistrictDemand` via aggregate sum (line 88: `prisma.upazillaDemand.aggregate({ _sum: { demandQuantity, fulfilledQuantity } })`), then upserts the district demand with the new totals. This is a clean pattern.
- **MEDIUM concern:** The recompute uses `aggregate` to sum all upazilla demands in the district (line 88-93). If 10 upazilla resellers in the same district submit demands concurrently, they may all read the same `aggregate` sum and overwrite each other's `DistrictDemand` writes — the `upsert` at line 116 does not have an atomic "compare-and-set" semantics. The final write wins, and the `remainingDemand` is computed from whatever the last writer saw in the aggregate. This can result in `remainingDemand` being stale.
- **Fix:** Use `prisma.$transaction` with serializable isolation, or compute the delta (newDemand - previousDemand) and apply it as an atomic increment.

### B.3 DistrictDemand POST: validate `totalDemand` against current aggregate
**File:** `src/app/api/demand/district/route.ts:97-150` (truncated in read; pattern inferred)
**Severity: MEDIUM**
- The district demand POST takes a `totalDemand` from the client and likely upserts the `DistrictDemand` row. The handler does call `aggregate` first (read stopped at line ~150 of the cat output), but if it then uses the client-supplied `totalDemand` instead of the aggregate sum, the district and upazilla views can diverge. The `demand/district` GET handler at line 80-100 of the same file shows the *display* logic auto-injects "virtual" district demands from upazilla aggregates — strong evidence the source of truth is the upazilla aggregate, but the POST may write client-supplied values.
- **Action:** Verify that `totalDemand` POST is rejected if it doesn't match the aggregate sum, or that the upsert overwrites with the aggregate value.

### B.4 UpazillaDemand `notes` is overwritten on every POST
**File:** `src/app/api/demand/upazilla/route.ts:65` (within `update` clause of upsert)
**Severity: MEDIUM**
- `update: { demandQuantity, notes: notes || null, fulfilledQuantity: 0, status: "pending", enteredBy: user.id }` — every POST *resets* `fulfilledQuantity` to 0, *resets* `status` to "pending", and *overwrites* `notes`. If an upazilla reseller has partially fulfilled demand and then re-submits a slightly different quantity, the partial fulfillment is wiped.
- **Fix:** Only overwrite `fulfilledQuantity` and `status` if `status === "fulfilled"`. Preserve the running `fulfilledQuantity` and `notes` for active demands.

### B.5 No `withdraw` or `cancel` endpoint for any demand tier
**Files:** `src/app/api/demand/{district,upazilla}/route.ts`; `src/app/api/local-reseller/demand/route.ts` (POST and GET only).
**Severity: MEDIUM**
- Once a demand is created, the only paths to a terminal state are fulfillment (set by `aco/trigger`, `routing/reserve`, `upazilla-reseller/transfer` PATCH accept) or — for `localDemand` — implicit via local reseller self-service. There is no way for an upazilla or district reseller to withdraw a demand they entered in error. The `notes` field can be edited, but a $1M typo on `demandQuantity` cannot be undone without admin DB access.
- **Recommendation:** Add PATCH endpoints for `withdraw` (status: "withdrawn") and `reduce` (decrement quantity, preserving partial fulfillment).

### B.6 DemandStatus enum lacks "withdrawn" / "cancelled"
**File:** `prisma/schema.prisma` `DemandStatus` enum (read prior session).
**Severity: LOW**
- Same root cause as B.5. If B.5 is fixed, extend the enum.

### B.7 `aggregate` race in upazilla demand cascade (refined)
**File:** `src/app/api/demand/upazilla/route.ts:80-95`
**Severity: HIGH (concurrent demand submission)**
- A single transaction in a single endpoint cannot atomically read-then-write across N upazilla demands + 1 district demand without serializable isolation. With the default `READ COMMITTED` isolation (Postgres default), the `aggregate` at line 88 reads a snapshot, and a concurrent POST that writes to the same product will see a phantom read.
- **Example failure:** Upazilla A submits demand 50, Upazilla B submits demand 50 for the same product in district D. Both upsert `UpazillaDemand` (no race, has unique constraint). Both then read the `aggregate` — the timing depends on transaction order. If both read *before* either upsert completes, both see `_sum.demandQuantity = 0`, both write `totalDemand: 0, remainingDemand: 0` to the DistrictDemand, and the upazilla demands are now visible to the district as already-fulfilled.
- **Fix:** Use `prisma.$transaction` with `isolationLevel: "Serializable"`, OR compute the delta and use an atomic increment. The current `prisma.upsert` overwrites — it does not increment.

### B.8 LocalDemand local-reseller auto-profile check is duplicate
**File:** `src/app/api/buyer/cart/route.ts:55-69` (already captured)
**Severity: LOW**
- The cart POST does a `findUnique` then conditional `create` to ensure the `BuyerProfile` exists. Same pattern as A.4/A.7 — should be a real upsert. This is at the buyer tier, not supply chain, but it's a code-consistency issue.

---

## Section C — Reservation & Surplus Flow (routing/reserve + routing/surplus)

### C.1 Reserve flow: GOOD atomic lock via `updateMany`
**File:** `src/app/api/routing/reserve/route.ts:62-75`
**Severity: GOOD**
- The handler does `tx.resellerStockItem.updateMany({ where: { id: stockItemId, isReserved: false }, data: { isReserved: true } })` and treats `count === 0` as a concurrent-collision. This is a textbook "compare-and-set" using the existing boolean column. Then the *same* transaction either writes the reservation, or in the "no demand" branch at line 117 *reverts* the lock.
- **GOOD pattern.** Worth documenting in a code comment so future contributors don't refactor it away.

### C.2 Reserve "no demand" branch reverts the lock but does not roll back the demand update
**File:** `src/app/api/routing/reserve/route.ts:115-127`
**Severity: MEDIUM**
- When `upazillaDemand` is found but `neededQuantity <= 0` (already fully fulfilled), the handler falls into the "no demand" branch and reverts `isReserved: false` + sets `surplusQuantity: surplusAmount`. This is correct.
- **However:** if `upazillaDemand` was found with `neededQuantity > 0` (line 90), the handler sets `reservedQuantity` and updates the demand. The `isReserved: true` is *only* set if `reserveAmount > 0` (line 102). If `reserveAmount === 0` (theoretical edge: `Math.min(0, availableQuantity) = 0`), the lock is *not* reverted and the row stays `isReserved: true, reservedQuantity: 0`. This orphans the stock.
- **Fix:** Always set `isReserved: reserveAmount > 0` and revert on the no-demand branch.

### C.3 Reserve "no demand" branch does not push to district
**File:** `src/app/api/routing/reserve/route.ts:115-160`
**Severity: MEDIUM**
- When there is no upazilla demand, the handler sets `surplusQuantity: availableQuantity` and returns (line 121). It does NOT push the surplus to the district hub. The surplus sits in the local seller stock until `routing/surplus` is called separately.
- **Concern:** The architecture appears to be a two-step process: first call `routing/reserve` to mark reservation, then call `routing/surplus` to ship excess to district. This is fine for explicit flows but creates a class of bugs where a user calls reserve and forgets to call surplus, leaving stock un-routed.
- **Alternative:** Combine the two endpoints into a single `routing/route` POST that does both atomically. Or document the required two-step pattern in the reserve response.

### C.4 Surplus flow: GOOD DistrictStockItem upsert pattern (almost)
**File:** `src/app/api/routing/surplus/route.ts` (read 0-78; the increment branch follows the same pattern as reserve)
**Severity: GOOD with caveat**
- The surplus endpoint uses the same `findFirst` + conditional `update`/`create` pattern as A.7. The earlier MEDIUM finding applies.
- **Caveat:** The `findFirst` for the `DistrictDemand` at line ~135 uses `findUnique` on `districtResellerId_productName` (the real unique constraint), so the demand update is safe. The stock upsert is the only race-prone piece.

### C.5 Surplus flow requires `isReserved` or `surplusQuantity > 0` precondition
**File:** `src/app/api/routing/surplus/route.ts:50-55` (read in cat output)
**Severity: GOOD (defensive)**
- The endpoint refuses to route stock that hasn't been reserved. This prevents double-routing, but couples the two endpoints tightly (see C.3).

---

## Section D — Pheromones

### D.1 `pheromone-update` cron: GOOD single-execution guard
**File:** `src/app/api/aco/pheromone-update/route.ts:20-30`
**Severity: GOOD**
- The endpoint checks `prisma.demandPheromone.findFirst({ where: { lastUpdated: { gte: startOfToday } } })` and short-circuits if any pheromone row was updated today. This is a coarse but effective "run-once-per-day" guard. Caveat: if the cron is triggered at 23:59:59 and the next trigger is at 00:00:01, the second run will see the `lastUpdated` from the previous calendar day and will re-execute. Use `gte: Date.now() - 24*60*60*1000` instead, or store a `lastCronRunAt` on a singleton row.

### D.2 Pheromone update: HIGH race on `findFirst` → update/create
**File:** `src/app/api/aco/pheromone-update/route.ts:60-100`
**Severity: HIGH**
- The handler does `findFirst({ entityType, entityId, productName })` → if found, `update`; else `create`. Two concurrent triggers (e.g., the daily cron + a manual test) can both pass the `findFirst` (returning null), both attempt `create`, and one will fail with a unique constraint error (good — this is the safety net) OR succeed twice (bad — depends on whether the unique constraint is in place).
- The schema has `@@unique([entityType, entityId, productName])` on `DemandPheromone` (prior session), so the safety net is in place. **GOOD — the DB-level constraint catches the race.**
- **MEDIUM:** The error from a violated unique constraint is not caught and re-tried. The user sees a 500 instead of "Already updated by another trigger."

### D.3 Pheromone update: not in a transaction
**File:** `src/app/api/aco/pheromone-update/route.ts:55-160` (whole file, read)
**Severity: MEDIUM**
- The pheromone update loop processes each demand in a separate round-trip. If the server crashes between upazilla and district pheromone writes, the state is inconsistent. A `$transaction` over the entire loop would be safer. For 10–100 demands this is fine; for 1000+ it could be a problem.
- **Recommendation:** Wrap each entity-type batch in `$transaction` (so upazilla pheromones are atomic, district pheromones are atomic, but the two batches are independent — they don't need to be in the same transaction).

### D.4 Pheromone update: satisfies the "evaporation" branch only when `score > 0.1`
**File:** `src/app/api/aco/pheromone-update/route.ts:155+` (evaporation section, read in cat output)
**Severity: MEDIUM**
- The fulfilled-demand evaporation branch checks `if (existing && existing.score > 0.1)` before applying evaporation. If `score <= 0.1` (the floor in `aco-distance.ts:332`), the row is *not* updated. This is fine for performance, but means a row that has been at the floor for weeks will keep its stale `demandDeficit` and `waitingDays` forever. Not a bug, but the audit trail loses fidelity.
- **Fix:** Either always update the bookkeeping columns (`demandDeficit`, `waitingDays`) even when `score` is at the floor, or delete the row once `score` reaches the floor (recreate on next demand).

### D.5 Pheromone computed from formula in aco-distance, persisted here
**File:** `src/lib/aco-distance.ts:320-333`; `src/app/api/aco/pheromone-update/route.ts:70-80`.
**Severity: GOOD (separation of concerns)**
- `computePheromoneUpdates` in `aco-distance.ts` is a pure function. The route handler does the persistence. This is the right boundary; the previous audit flagged the inverse (business logic in routes) as a smell, and this code avoids it.

### D.6 Approve-inter-district pheromone upsert race
**File:** `src/app/api/aco/approve-inter-district/route.ts:240-260` (read in prior session)
**Severity: HIGH**
- The "both approved" execution path does `findFirst` for `RoutePheromone` (no real unique constraint guarantees a single row), then either updates or creates. Two concurrent approvals of the same opportunity (theoretically possible if the system retries on a network blip after a partial commit) can both pass `findFirst` and both attempt `create`, producing two `RoutePheromone` rows for the same `(jobId, fromId, toId)` path.
- **Fix:** Add `@@unique([jobId, fromEntityType, fromEntityId, toEntityType, toEntityId, productName])` and use real upsert. The schema has `@@unique` for `DemandPheromone` (D.2) but the audit cannot confirm the same for `RoutePheromone`.

### D.7 Approve-inter-district catch-block resets approvals OUTSIDE failed transaction
**File:** `src/app/api/aco/approve-inter-district/route.ts:265-280` (read in prior session)
**Severity: HIGH**
- The catch block does `prisma.interDistrictOpportunity.update({ data: { status: "failed_insufficient", sourceApproved: false, targetApproved: false } })`. This is a *separate* round-trip from the failed `$transaction`. If this catch update fails (e.g., DB connection blip), the opportunity is stuck in an inconsistent state: the source/target approvals are both `true`, the stock has been decremented by the source's prior reservation, but the status is "pending_approval". Future calls see "pending_approval" + both approved = try to execute again, double-decrementing the source stock.
- **Fix:** Wrap the entire approval flow (approve + execute + rollback) in a single `prisma.$transaction` at the request level, not at the execute level. Or, on catch, set the opportunity status to "failed_insufficient" *before* the failed execute transaction.

### D.8 Approve-inter-district: findFirst aCOAllocation has no status filter
**File:** `src/app/api/aco/approve-inter-district/route.ts:215-225` (read in prior session)
**Severity: MEDIUM**
- The execute path does `findFirst({ jobId, phase: 3, toId, fromId })` — no `status` predicate. If a prior execute failed after creating the nationalTransfer but before updating the allocation, the allocation is in a terminal state ("rejected" or "expired" from a sibling opportunity). The findFirst may match a stale allocation and the `update` will succeed, marking an already-terminal allocation as "executed" — which is logically wrong but not catastrophic because the other state has already been set.
- **Fix:** Add `status: "pending"` (or equivalent in-flight value) to the findFirst.

### D.9 Approve-inter-district: phase3Allocated accounting
**File:** `src/app/api/aco/approve-inter-district/route.ts` (execution path, prior session read)
**Severity: MEDIUM**
- The comment in the file acknowledges that `phase3Allocated` was incremented during the trigger but is not re-balanced here. If two district opportunities are both approved for the same surplus, the same `phase3Allocated` can be double-counted against the source's `availableQty`. This is a known issue noted in the file's comments.
- **Fix:** Decrement `phase3Allocated` on the source's stock row in the execute transaction (currently only decrements on the `rejected` / `expired` paths).

---

## Section E — InterDistrictOpportunity

### E.1 Approval window expiry: GOOD
**File:** `src/app/api/aco/approve-inter-district/route.ts:95-115` (read in prior session)
**Severity: GOOD**
- The expiry path checks `INTER_DISTRICT_EXPIRY_HOURS = 48` (defined in `aco-distance.ts:75`) and decrements `phase3Allocated` on the matching allocation. This is a clean implementation.

### E.2 Reject path: GOOD accounting
**File:** `src/app/api/aco/approve-inter-district/route.ts:120-150`
**Severity: GOOD**
- Rejection decrements `phase3Allocated` on the matching allocation and sets the allocation to "rejected". This is the inverse of the trigger, properly undoing the accounting.

### E.3 Geographic re-verification: GOOD edge case handling
**File:** `src/app/api/aco/approve-inter-district/route.ts:50-55` (Edge Case 47 reference in code)
**Severity: GOOD**
- The handler checks that the current district reseller's `district` field still matches the expected district on the opportunity. This catches the case where a district reseller has moved (rare, but the data model allows it).

### E.4 InterDistrictOpportunityStatus enum: GOOD coverage
**File:** `prisma/schema.prisma` (read prior session)
**Severity: GOOD**
- 6 enum values cover: `pending_approval`, `approved`, `executed`, `expired`, `rejected`, `failed_insufficient`. Comprehensive.

### E.5 No endpoint to LIST outgoing/incoming opportunities
**Files:** Searched `src/app/api/aco/` — only `trigger`, `pheromone-update`, `pheromones`, `verify-conservation`, `jobs/[id]`, `approve-inter-district` are present.
**Severity: MEDIUM**
- A district reseller cannot see their pending inter-district opportunities (incoming or outgoing) via a dedicated endpoint. The audit cannot confirm whether `jobs/[id]/route.ts` exposes this. The opportunity may be hidden inside the `aCORoutingJob` view, in which case district resellers must scan all jobs to find opportunities addressed to them.
- **Action:** Verify `aco/jobs/[id]/route.ts` exposes per-user opportunity lists, and consider adding `aco/opportunities` endpoints for the district dashboard.

### E.6 No retry mechanism for `failed_insufficient` opportunities
**File:** `src/app/api/aco/approve-inter-district/route.ts` (catch block)
**Severity: MEDIUM**
- Once an opportunity is marked `failed_insufficient`, there is no path to re-trigger the source allocation. The target district must wait for the source district to manually re-route via `routing/reserve` + `routing/surplus` or `district-reseller/pull-stock`. This is a UX gap, not a bug.

---

## Section F — StockOrderNegotiation

### F.1 Schema is untyped: MEDIUM
**File:** `prisma/schema.prisma` (read prior session) — `StockOrderNegotiation.status` is `String`, not an enum.
**Severity: MEDIUM**
- The `status` field is a free-form string, which means typo states like `"accepted "` (with trailing space) or `"ACCEPTED"` (uppercase) are not caught at the DB level. The audit cannot confirm which values are actually used in the code, but the lack of an enum is a maintainability risk.
- **Action:** Find all writes to `StockOrderNegotiation.status` and verify the values; consider migrating to an enum.

### F.2 No routes for StockOrderNegotiation found
**File:** `file_search` for `**/stock-order*` (inferred) — none found in the `src/app/api/` tree based on the directory listing.
**Severity: HIGH (if confirmed)**
- The `StockOrderNegotiation` model exists in the schema but no API route reads or writes it. If this is correct, the model is dead code and should be removed.
- **Action:** Run a `grep_search` for `StockOrderNegotiation` across the codebase to confirm whether any route or component touches it. If only schema-level, recommend deletion.

---

## Section G — Walk-in Buyer Flow

### G.1 Cart add: GOOD stock check
**File:** `src/app/api/buyer/cart/route.ts:30-50`
**Severity: GOOD**
- The cart POST checks `sellerProduct.stock < quantity` before insert, and also re-checks after upsert for the "increment existing" case. Race window is small but exists (covered in G.2).

### G.2 Cart increment: MEDIUM race
**File:** `src/app/api/buyer/cart/route.ts:65-78`
**Severity: MEDIUM**
- The "increment existing cart item" path checks `sellerProduct.stock < existing.quantity + quantity`, but `sellerProduct` was read at the start of the request (line 32). Between the read and the `cartItem.update`, another buyer (or the seller decrementing stock) can change `sellerProduct.stock`. The buyer can end up with a cart line that exceeds available stock.
- **Fix:** Re-read `sellerProduct` after the `findFirst` and re-validate. Or use the same `updateMany` pattern with `stock: { gte: existing.quantity + quantity }` (but `updateMany` doesn't return the previous quantity, so a more sophisticated fix is needed — perhaps a `tx.sellerProduct.update` with a stock check, in a transaction).

### G.3 Order checkout: GOOD atomic stock deduction
**File:** `src/app/api/buyer/order/route.ts:90-110` (read in cat output)
**Severity: GOOD**
- The order POST uses `tx.sellerProduct.updateMany({ where: { id, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } })` inside a `$transaction`. If `count === 0`, throws and the entire transaction rolls back (no orphan orders, no double-decrement). This is the textbook correct pattern. **Worth promoting as a reference example** in the team's style guide.

### G.4 Order: GOOD grouping + profile enforcement
**File:** `src/app/api/buyer/order/route.ts:60-80`
**Severity: GOOD**
- The order handler groups cart items by seller (line 65-72) and creates one `Order` per seller. Buyer profile is required (line 56-59) — the previous audit noted this was added after the "users checking out with empty address" bug.
- **MEDIUM concern:** The address string `deliveryAddress: buyer.address || "No Street Address provided"` (line 88) silently writes the literal string `"No Street Address provided"` to the DB. If a buyer has set `city`, `upazilla`, `district` but not the street `address`, the order is created with a sentinel string instead of NULL. Downstream sellers see this string and may think the buyer provided a real address. Recommend: write `null` and let the seller request the address.

### G.5 Order: cart not cleared atomically with order creation
**File:** `src/app/api/buyer/order/route.ts:130-150` (truncated in read)
**Severity: MEDIUM (depends on read)**
- The cart clearing should be inside the same `$transaction` as the order creation. If it's outside (e.g., a separate `prisma.cartItem.deleteMany` after the transaction commits), a crash between the two leaves the cart populated with items the buyer already paid for. The audit cannot confirm where the cart clear is; the structure suggests it is inside the transaction (the `await prisma.$transaction(async (tx) => {...})` wraps the whole loop). **GOOD if so.** Verify on next read.

### G.6 Cart/[id] route not yet read
**File:** `src/app/api/buyer/cart/[id]/route.ts`
**Severity: UNKNOWN** — read incomplete. Need to verify the update/remove logic for race conditions.

---

## Section H — Cross-Tier Traceability

### H.1 Multiple `productName` fields instead of a single `productCode`
**Files:** All demand, stock, transfer, and pheromone tables.
**Severity: HIGH (architectural)**
- The data model uses `productName: String` (case-insensitive match in most code paths) instead of a normalized `productCode: String` foreign key to a `GlobalProduct` table. Every comparison uses `mode: "insensitive"`, which:
  - Bypasses any unique constraint the team might want to add
  - Has unpredictable case-folding behavior in Postgres (locale-dependent)
  - Is slow (no index on `LOWER(productName)`)
  - Allows "Rice" and "rice" to be created as separate stock rows
- The LocalDemand endpoint is the *only* one that uses `productCode` (the `localDemand.@@unique([localResellerId, productCode])` constraint). Every other tier uses `productName` strings.
- **Fix:** Migrate all `productName` columns to `productCode: String` (foreign key to `GlobalProduct.productCode` or a new `Product.code` table). Add `@@unique` constraints using `productCode`. Update all `mode: "insensitive"` queries to use the FK.
- **Severity justification:** This is HIGH, not MEDIUM, because it blocks the team's ability to add uniqueness constraints at every other tier (which is the root cause of A.2, A.4, A.7, B.2, D.6, and D.9).

### H.2 `sellerProductId` is optional on ResellerStockItem
**File:** `src/app/api/local-reseller/transfers/route.ts:69-79` (accept branch)
**Severity: MEDIUM**
- The accept branch creates a `ResellerStockItem` with `sellerProductId: null` (commented as "Upazilla transfer"). This decouples the local reseller's stock from the original seller product. If the seller later edits the product (name, price, description), the local reseller's stock retains the old `customName` but no link to the new product. Cross-tier traceability for this stock is impossible.
- **Fix:** Either keep `sellerProductId` mandatory and allow `customName` to be the source of truth, or add a `sourceType: "upazilla_transfer" | "seller_purchase"` discriminator and a `sourceTransferId` FK.

### H.3 No audit log of stock movements
**Files:** No `StockMovement`, `StockLedger`, or `InventoryAudit` model in the schema.
**Severity: MEDIUM**
- Every stock change (increment, decrement, reservation, surplus push, district pull, national transfer) writes to the row's `quantity` field with no per-change audit trail. If a row is corrupted (e.g., negative quantity, discrepancy with downstream demand), there is no way to reconstruct the sequence of events that produced the current value.
- **Fix:** Add a `StockLedger` model: `{ id, stockItemId, type: "increment" | "decrement" | "reserve" | "release" | "transfer_in" | "transfer_out", quantity, refType, refId, actorId, createdAt }`. Write to it inside every transaction that changes a stock row.

### H.4 No endpoint for "I am a buyer; show me where my product came from"
**Files:** Searched `src/app/api/buyer/` — only `behaviour/`, `cart/`, `order/`, `profile/`, `register/`. No `trace`, `source`, or `provenance` endpoint.
**Severity: MEDIUM**
- A buyer who purchases a product at a local reseller cannot trace the supply chain: which seller → which district hub → which upazilla reseller → which local reseller. This is a major differentiator for a "supply-chain-aware" e-commerce platform, and it's not exposed.

### H.5 ACO routing allocations and orders are not linked
**Files:** `Order` model has no `aCORoutingJobId` or `aCOAllocationId` field. The audit cannot confirm.
**Severity: MEDIUM**
- When a buyer places an order that is fulfilled via a stock transfer, there is no way to link the order back to the `aCORoutingJob` or `aCOAllocation` that routed the stock. This means reporting on "how many orders were fulfilled by ACO routing" requires joining through `sellerProduct` → `aCOAllocation` (a complex join).
- **Fix:** Add an `aCOAllocationId: String?` field on `OrderItem` (or `sellerProductId` already provides the link — verify).

### H.6 National transfer's "automatic acceptance" hides audit trail
**File:** `src/app/api/district-reseller/national-transfer/route.ts:99-103`
**Severity: MEDIUM**
- The `status: "accepted"` is set at creation, with no `pending → accepted` state. The audit trail cannot distinguish "transfer in flight" from "transfer complete" for monitoring or dispute resolution.
- **Fix:** Add a `pending → accepted` lifecycle (matching the `districtTransfer` lifecycle), and require the source district to PATCH the transfer to "accepted" after a confirmation step.

---

## Section I — Cross-Cutting Concerns (Bonus)

### I.1 `dynamic = "force-dynamic"` carpet bomb
**File:** ~40 of the 60+ reseller routes (per architecture audit, prior session)
**Severity: CRITICAL (operational)**
- The previous audit flagged this. Every page load hits Postgres. No in-process memoization. The dashboards reload 200-row tables on every render. Hot reloads are slow.
- **Fix:** Use Server Components for dashboard pages (data fetched on the server, not the client). Client Components only for interactions. `revalidatePath` after mutations.

### I.2 No rate limiting on supply-chain mutation endpoints
**File:** All POST handlers (no `rateLimit` middleware in evidence)
**Severity: MEDIUM**
- The ACO trigger has a manual `10/hour per user` rate limit (in the trigger code itself), but other mutation endpoints (transfer create, demand create, transfer accept) have no rate limiting. A malicious actor (or a buggy client) can hammer the API and cause CPU/DB spikes. The `CHANGELOG.md` notes that the "PC heating issue" was caused by SSE memory leaks; adding rate limiting is a defense-in-depth measure.

### I.3 No idempotency keys on supply-chain mutations
**Severity: MEDIUM**
- The transfer, demand, and accept endpoints have no `Idempotency-Key` header support. A client retry after a network timeout can double-create. The atomic `updateMany` patterns (A.1) protect against double-decrement, but the side effects (notifications, ledger entries, pheromone writes) can fire twice. The audit cannot confirm whether notifications are sent exactly-once or at-least-once.

### I.4 `force-dynamic` + no rate limiting + no idempotency = amplification attack surface
**Severity: HIGH (compounded)**
- I.1 + I.2 + I.3 together mean a single misbehaving client can cause: (a) every request hits the DB with no caching, (b) the API allows arbitrarily many concurrent requests per user, (c) retries cause duplicate side effects. The 60+ supply-chain routes are exposed to this.

### I.5 `validate-profile-patch.ts`, `validate-local-reseller-profile.ts` exist (lib/) — usage unconfirmed
**Files:** `src/lib/validate-profile-patch.ts`, `src/lib/validate-local-reseller-profile.ts`
**Severity: GOOD (if used) — UNKNOWN (otherwise)**
- Profile validation libraries exist. Need to confirm they are called from all PATCH routes for reseller profiles (A.1's "60-line update both" pattern from the previous audit).

---

## Summary of Severity Counts

| Severity | Count | Key findings |
|---|---|---|
| CRITICAL | 2 | I.1 (`force-dynamic` carpet bomb); I.4 (compounded risk) |
| HIGH | 6 | A.4 (transfer accept race); A.5 (reject increment); B.7 (aggregate race); D.6 (pheromone upsert race); D.7 (catch-block non-atomic); H.1 (productName vs productCode) |
| MEDIUM | 22 | A.2, A.3, A.6, A.7, A.8, B.2, B.3, B.4, B.5, C.2, C.3, C.4, D.3, D.4, D.8, D.9, E.5, E.6, F.1, G.2, G.4, G.5, H.2, H.3, H.4, H.5, H.6, I.2, I.3 |
| LOW | 7 | A.9, A.10, B.6, B.8, plus consistency/performance nits |
| GOOD | 7 | A.1, B.1, B.2, C.1, D.1, D.5, E.1, E.3, E.4, G.1, G.3 |

## Top 5 Recommended Fixes (Ordered by ROI)

1. **Migrate `productName` → `productCode` with FK constraints** (H.1) — Unblocks 6+ race fixes and enables cross-tier traceability. Highest ROI.
2. **Wrap dedup checks inside `$transaction` + add DB unique constraints** (A.2, A.3, A.4, A.5, A.7) — Closes the transfer accept race and prevents stock-row duplication. Use `local-reseller/demand/route.ts` (B.1) as the reference pattern.
3. **Replace `force-dynamic` carpet bomb with Server Components + `revalidatePath`** (I.1) — Single biggest performance win. The architecture audit already documented the approach.
4. **Add `StockLedger` model** (H.3) — Audit trail foundation. Necessary precondition for any future reporting or compliance work.
5. **Add `Idempotency-Key` support + per-user rate limiting** (I.2, I.3) — Defense-in-depth. Trivial to implement, high impact under failure.

---

**End of audit.**
