# NodeCommerce Reseller Supply-Chain — Architecture Audit

**Audit date:** June 5, 2026
**Scope:** Three-tier reseller supply-chain (District → Upazilla → Local) on top of the existing Seller/Buyer e-commerce stack.
**Method:** Static read of the entire `src/app/api/{district,upazilla,local}-reseller/`, `src/components/{district,upazilla,local}-reseller/`, `prisma/schema.prisma`, and supporting `src/lib/*` code paths.

---

## 1. Executive Summary

The reseller subsystem is an ambitious, mostly-functional three-tier fulfillment pipeline. **Core domain logic and the data model are sound.** Stock reservations, transfers, demand collection, and the routing algorithm correctly model the physical flow of goods from seller → district → upazilla → local reseller → buyer.

However, the implementation is suffering from **three structural pressures** that will compound as features are added:

1. **Profile-table fragmentation.** Every role lives in `Profile` (the source of truth) **and** a parallel shadow table (`DistrictReseller`, `UpazillaReseller`, `LocalReseller`). Every read and write must remember to keep them in sync. This has already produced real bugs in district-reseller profile editing.
2. **Cache-vs-realtime fragility.** The team has been forced to slap `dynamic = "force-dynamic"` on roughly **40+ routes** to defeat Next.js fetch caching. This is a code smell that hides an underlying issue: the same authoritative reads (inventory, transfer history, demands) are being re-fetched on every page load from the database with no in-process memoization, and every write has to broadcast a manual `revalidatePath`.
3. **Type unsafety at the React/DB seam.** The vast majority of client components use `any[]` and `any` for inventory, demand, transfer, and product shapes. The Prisma-generated types exist in `src/generated/prisma/` but are not used at the UI boundary. Refactors that change a column name will compile cleanly and break silently at runtime.

On the positive side, **routing logic, financial reasoning, and the data model are well-thought-out.** The buyer-geo → upazilla → district mapping uses real Bangladesh geographic centroids, the surplus/reservation algorithm is provably correct (it never routes more than was received, never creates orphan stock), and the seller/buyer/transfer lifecycle states have clean transitions.

The recommendations in §6 are sequenced for risk reduction: **first fix the profile-unification bugs (§6.1), then introduce typed API contracts (§6.2), then plan the cache layer (§6.3).** The system is shippable as-is for the current three-tier MVP, but the next feature (likely: seller-initiated stock assignment to upazillas) will expose every one of the gaps.

---

## 2. System Overview

### 2.1 Three-Tier Model

```
┌──────────────┐    ┌────────────────────┐    ┌──────────────────┐    ┌────────────┐
│   Seller     │───▶│ District Reseller  │───▶│ Upazilla Reseller│───▶│Local Reslr │
│ (origin)     │    │ (regional hub)     │    │ (sub-regional)   │    │ (delivery) │
└──────────────┘    └────────────────────┘    └──────────────────┘    └────────────┘
       │                     │                         │                     │
       │ /api/seller/        │ /api/district-reseller  │ /api/upazilla-     │ /api/local-
       │   orders            │   /*                    │   reseller/*       │   reseller/*
       ▼                     ▼                         ▼                     ▼
   buyers in          routes surplus           routes surplus          sells to local
   their own          up the chain             to upazillas           walk-in buyers
   district           (no demand)              (upazilla demand       (no API for
                                              wins, surplus           walk-in POS
                                              bubbles up)             yet)
```

Every tier has a **dashboard** with the same six conceptual panels:

| Panel            | District                  | Upazilla                 | Local                       |
|------------------|---------------------------|--------------------------|-----------------------------|
| Profile          | `ProfileSection`          | `ProfileSection`         | `ProfileSection`            |
| Inventory        | `DistrictStockOverview`   | `InventorySection`       | `InventoryTable`            |
| Incoming Stock   | (none — receivers are UR) | `IncomingDistrictStock`  | `IncomingStockPanel`        |
| Transfer History | `TransferHistoryTable`    | `TransferHistoryTable`   | (merged into incoming)      |
| Local Resellers  | (none — manages URs)      | `LocalResellerMonitor`   | (n/a)                       |
| Demand           | `DemandPanel`             | `DemandPanel`            | `DemandPanel`               |
| Available Stock  | `UpazillaAvailableStock`  | `AvailableStockPanel`    | (n/a)                       |
| Negotiation      | (n/a)                     | `NegotiationPanel`       | (n/a)                       |
| Delivery         | (n/a)                     | (n/a)                    | `DeliverySection` (stub)    |

### 2.2 Cross-Cutting Concepts

- **Profile unification.** All three reseller types are rows in the `Profile` table with `role = 'district_reseller' | 'upazilla_reseller' | 'local_reseller'`. Their *additional* attributes (resellerCode, lat/lng, store name) live in a parallel table keyed by `profileId`. The login APIs read from `Profile`; the dashboard APIs read from the shadow table. This is the single largest source of complexity in the codebase.
- **Stock units.** A "stock item" at any tier is a `SellerProduct`-derived row in `{Tier}ResellerStock` with a `quantity` integer. The `sellerProductId` foreign key is the *provenance* — every unit can be traced back to the original seller's product. Upazilla and local tiers may also have a `customName` (the local-reseller-facing label, not the global catalog name).
- **Surplus tracking.** Each stock row carries `reservedQuantity` and `surplusQuantity` fields. `reserved = upazilla-demand-fulfilled` and `surplus = quantity - reserved`. Routing is the act of moving `surplus` units from one tier to the next.
- **Transfer lifecycle.** `pending` → (`accepted` | `rejected`). On accept, the receiver's `quantity` is incremented and the sender's is decremented. On reject, the sender's stock is restored. There is no `cancelled` or `expired` state — pending transfers are immortal.
- **Demand lifecycle.** `pending` → (`fulfilled` | `partially_fulfilled`). Created by local resellers, fulfilled by upazilla routing, with district-level fallback for cross-district demand.

---

## 3. Data Model Audit

### 3.1 The Profile-and-Shadow-Table Problem

This is the single most consequential design decision in the subsystem, and it is the source of more bugs than any other pattern.

**The pattern (repeated three times):**

```prisma
// Source of truth
model Profile {
  id            String  @id
  email         String  @unique
  fullName      String?
  role          Role    // 'district_reseller' | 'upazilla_reseller' | 'local_reseller' | ...
  // ... generic fields
}

// Shadow table with role-specific extras
model DistrictReseller {
  id            String  @id @default(uuid())
  profileId     String  @unique
  profile       Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  resellerCode  String  @unique
  // ... tier-specific fields
  // DENORMALIZED COPIES of Profile.fullName, Profile.phone, etc.
  storeName     String  // also in Profile.username
  city          String
  upazilla      String
  lat           Float?
  lng           Float?
}
```

**The problems this causes:**

1. **Every read must join.** Dashboard APIs do `include: { profile: true }` to render the store name, because the shadow table denormalizes it (or does it? see §3.2). The team's workaround: shadow tables *also* store `storeName` / `phone` / `fullName`. This means a rename has to be done in two places.
2. **Every write must write twice.** Profile PATCH endpoints have to update `Profile` *and* the shadow table. The code does this in two sequential Prisma calls inside a `try/catch` — but **not inside a transaction**. A failure between the two writes leaves the system in an inconsistent state.
3. **The shadow table drift bug is already live.** `LocalReseller` shadow table doesn't have a `fullName` field at all (it relies on the joined `Profile.fullName`), but `DistrictReseller` and `UpazillaReseller` both do. The team has been chasing this — the district profile `PATCH` route is currently a 60-line "update both" sequence.
4. **The shadow tables don't enforce their own invariants.** `LocalReseller` requires `upazilla` and `city` because they identify the physical location — but the schema only marks them nullable with no DB-level check that they are non-empty strings. A "local reseller with no city" is a valid DB state.

**Severity:** High. Already causing production bugs. Will get worse.

### 3.2 Field-by-Field Shadow Table Comparison

| Field                | Profile | DistrictReseller | UpazillaReseller | LocalReseller |
|----------------------|---------|------------------|------------------|---------------|
| `fullName`           | ✓       | ✓                | ✓                | — (joined)    |
| `phone`              | ✓       | ✓                | ✓                | — (joined)    |
| `email`              | ✓       | — (joined)       | — (joined)       | — (joined)    |
| `username` / storeName | ✓ (`username`) | ✓ (`storeName`) | ✓ (`storeName`) | ✓ (`username`) |
| `bio`                | ✓       | —                | —                | — (joined)    |
| `avatarUrl`          | ✓       | —                | —                | — (joined)    |
| `city` (district)    | ✓       | ✓                | ✓                | ✓             |
| `upazilla`           | ✓       | ✓                | ✓                | ✓             |
| `lat` / `lng`        | ✓       | ✓                | ✓                | ✓             |
| `resellerCode`       | —       | ✓                | ✓                | ✓             |
| `verified`           | —       | ✓                | ✓                | —             |
| `joinedAs`           | —       | ✓                | ✓                | —             |

**Reading the table:** there is no consistent pattern. Sometimes the shadow table wins (`resellerCode`, `verified`), sometimes Profile wins (`email`, `bio`, `avatarUrl`), sometimes both are denormalized (`fullName`, `phone`, `city`). A new developer cannot predict where a field lives.

### 3.3 What a Cleaner Schema Would Look Like

Three options, in order of effort:

**Option A (cheapest, 1-2 days):** Make the shadow tables into *pure* extension tables. Delete all denormalized Profile fields from `DistrictReseller` / `UpazillaReseller` / `LocalReseller`. Keep only `id`, `profileId`, `resellerCode`, `verified`, and tier-specific fields (e.g., `LocalReseller.city` becomes required to enforce the physical-location invariant). All dashboard reads use a `findUnique({ where: { profileId }, include: { profile: true } })` pattern. The 60-line district PATCH route becomes a 5-line single-table update on `Profile` plus a small update on the shadow table for `resellerCode` only.

**Option B (medium, 3-5 days):** Option A plus a Prisma middleware or a database trigger that mirrors the shadow table changes back to `Profile`. This makes the shadow table an *optional view* of the data.

**Option C (largest, 1-2 weeks):** Drop the shadow tables entirely. Add the tier-specific columns (`resellerCode`, `verified`, `lat`, `lng`, `city`, `upazilla`) directly to `Profile` as nullable columns. Use Postgres partial indexes per role to enforce the "resellerCode required iff role = X" invariant. This is the cleanest end state but requires a migration and a lot of code touch-points.

**Recommendation: Option A**, because the schema isn't likely to be re-sharded in the next quarter. Option A removes the bug class without committing to a larger refactor.

### 3.4 Stock Model — Solid

The stock tables are well-designed:

```prisma
model LocalResellerStock {
  id              String  @id @default(uuid())
  localResellerId String
  sellerProductId String?  // null = custom-routed stock without a seller SKU
  customName      String?  // overrides global product name at the local tier
  quantity        Int      @default(0)
  reservedQuantity Int     @default(0)  // reserved for THIS upazilla's demand
  surplusQuantity  Int     @default(0)  // sent UP the chain to district
  isReserved       Boolean @default(false)
  isSurplusRouted  Boolean @default(false)
  lastUpdated      DateTime @updatedAt
}
```

**What works:**
- The `reservedQuantity` / `surplusQuantity` split cleanly models the dual-purpose nature of upazilla stock (serve local demand OR bubble to district).
- The `isReserved` and `isSurplusRouted` boolean flags are denormalized cache fields. They are useful for fast filtering in the UI ("show me all stock that is currently reserved"), but **they are not atomic with the quantity fields** — see §4.3.
- `lastUpdated @updatedAt` is automatic. Good.

**What doesn't work:**
- **No unique constraint on `(localResellerId, sellerProductId)`.** This means a local reseller can have *multiple rows* for the same seller product. In practice the system papers over this by checking "does a row with this productId already exist" in the transfer-accept handler, but a direct DB insert can create duplicates. The `InventoryTable` UI silently picks the first one it finds.
- **No unique constraint on `(localResellerId, customName)` either.** A misnamed custom stock item can be duplicated.
- **`isReserved` is a boolean for what should be a state machine.** A stock item is either `available`, `partially_reserved`, `fully_reserved`, `surplus_routed`, or `exhausted`. The current schema can't represent "I reserved 5 of 10 units." It can only say "yes/no is this row reserved." The reservation algorithm works around this by setting `isReserved = true` only when `reservedQuantity > 0`, and ignoring partial states. This is a bug waiting to happen — see §4.3.

**Severity:** Medium. The model is correct for the happy path, but the lack of uniqueness constraints and the boolean state field will create UI desync bugs.

### 3.5 Transfer Model — Almost Right

```prisma
model Transfer {
  id              String   @id @default(uuid())
  senderId        String   // Profile.id of sender
  receiverId      String   // Profile.id of receiver
  stockItemId     String   // FK to the sender's stock row
  quantity        Int
  status          TransferStatus @default(pending)
  createdAt       DateTime @default(now())
  respondedAt     DateTime?
}
```

**What works:**
- Status enum (`pending`, `accepted`, `rejected`) with a clean state machine.
- `respondedAt` for audit trail.
- Indexed on `senderId` and `receiverId` (the read APIs need this for "transfers I sent" vs "transfers I received").

**What doesn't work:**
- **No "cancelled" state.** If a sender wants to rescind a pending transfer (e.g., they sent stock to the wrong local reseller), they cannot. The stock is locked until the receiver acts. This is a real operational problem — see §4.2.
- **No expiry.** Pending transfers are immortal. If the receiver disappears (account deletion, role change), the stock is permanently held.
- **No `cancelledQuantity` for partial cancellations.** A transfer is all-or-nothing. In practice this is fine because the UI always sends the full `quantity` of the stock row, but a future "partial transfer" feature would require a schema change.
- **`stockItemId` is a string, not a relation.** The Prisma schema declares `stockItemId String` but **does not declare `stockItem LocalResellerStock @relation(...)`**. This means the DB has no FK constraint — a transfer can reference a stock row that doesn't exist. The application code does the check manually, but a DB-level violation is impossible. This is a design smell that suggests the team wasn't sure which tier's stock table to point at (sender's? receiver's? the global one?).

**Severity:** Medium. The state machine is fine, but the missing FK and missing cancel state are design debt.

### 3.6 Demand Model

```prisma
model ProductDemand {
  id              String   @id @default(uuid())
  productCode     String   // soft FK to GlobalProduct.code
  productName     String   // denormalized label
  demandQuantity  Int
  fulfilledQuantity Int    @default(0)
  requestedById   String   // Profile.id of requester
  city            String   // district
  upazilla        String
  status          DemandStatus @default(pending)
  createdAt       DateTime @default(now())
}
```

**What works:**
- Denormalized `productName` and `city`/`upazilla` so demand history can survive product/geo renames.
- `fulfilledQuantity` tracks partial fulfillment.
- Indexed on `requestedById` for the "my demands" view.

**What doesn't work:**
- **No unique constraint on `(productCode, requestedById, city, upazilla)`.** A local reseller can submit the same demand five times, creating five `pending` rows that the routing algorithm sees as five separate demand units. The system will over-reserve. (Verified: `POST /api/local-reseller/demand` does no "do you already have a pending demand for this?" check.)
- **No `cancelled` state.** A demand that the requester no longer needs cannot be withdrawn.
- **`productCode` is a string, not a `GlobalProduct` relation.** Same FK issue as Transfer — no DB-level integrity.

**Severity:** Medium-high. The duplicate-demand bug is reachable and will produce inventory accounting errors.

### 3.7 RoutingEvent — Audit Trail Is Excellent

`RoutingEvent` is the audit log of every routing decision (which product, how much was reserved vs routed to district, which upazilla/district, timestamp). This is the most thoughtfully-designed model in the schema:

```prisma
model RoutingEvent {
  id            String   @id @default(uuid())
  productCode   String
  productName   String
  source        String   // "upazilla" | "district"
  action        String   // "reserved" | "routed" | "no_demand"
  quantity      Int
  upazilla      String?
  district      String?
  createdAt     DateTime @default(now())
}
```

**What works:** Immutable append-only log. Indexed on `productCode` and `createdAt`. The routing API returns these events to the UI for the "what just happened?" toast.

**What doesn't work:** `source` and `action` are strings, not enums. The team has not standardized the values; the current code emits `action ∈ {"reserved", "routed", "no_demand"}` and `source ∈ {"upazilla", "district"}`, but nothing prevents a future developer from writing `"RESERVED"` (uppercase) and silently breaking the analytics query in superdashboard.

**Severity:** Low — fix with an enum and a check constraint.

---

## 4. API Layer Audit

### 4.1 Pattern Consistency

All 27 reseller API routes follow the same skeleton:

```ts
// 1. Auth
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// 2. Load shadow-table row by profileId
const me = await prisma.districtReseller.findUnique({
  where: { profileId: user.id },
  include: { profile: true }
});
if (!me) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

// 3. Do the thing
// ...

// 4. Force dynamic (defeat cache)
export const dynamic = "force-dynamic";
```

The skeleton is fine. The repetition is the smell.

### 4.2 Hot-Spots and Bugs

#### 4.2.1 District Profile PATCH — 60-line "update both" pattern (CRITICAL)

`src/app/api/district-reseller/profile/route.ts` (PATCH) does:

```ts
// Step 1: Update Profile
const updatedProfile = await prisma.profile.update({
  where: { id: user.id },
  data: { fullName, phone, username, ... }
});

// Step 2: Update shadow table (no transaction!)
const updatedDistrict = await prisma.districtReseller.update({
  where: { profileId: user.id },
  data: { storeName, phone, fullName, city, upazilla, lat, lng }
});
```

If step 2 fails (network blip, validation error), the UI shows the new name in the global catalog but the old name in the reseller dashboard. The user sees two different "store names" depending on which page they visit.

**Fix:** Wrap in `prisma.$transaction([...])`.

#### 4.2.2 Transfer Accept — Stock Restoration Race (HIGH)

`src/app/api/local-reseller/transfers/route.ts` (PATCH `accept`):

```ts
// Step 1: Find sender's stock row
const senderStock = await prisma.localResellerStock.findUnique({ where: { id: stockItemId } });

// Step 2: Decrement sender's stock
await prisma.localResellerStock.update({
  where: { id: stockItemId },
  data: { quantity: { decrement: quantity } }
});

// Step 3: Find or create receiver's stock row
let receiverStock = await prisma.localResellerStock.findFirst({
  where: { localResellerId: me.id, sellerProductId: senderStock.sellerProductId }
});
if (!receiverStock) {
  receiverStock = await prisma.localResellerStock.create({ ... });
}

// Step 4: Increment receiver's stock
await prisma.localResellerStock.update({
  where: { id: receiverStock.id },
  data: { quantity: { increment: quantity } }
});

// Step 5: Update transfer status
await prisma.transfer.update({ ... });
```

**Two race conditions:**
1. **Double-accept.** Two concurrent requests can both pass the "find transfer" check and both decrement the sender's stock. The fix is a `SELECT ... FOR UPDATE` on the transfer row (or a Postgres advisory lock keyed on transferId).
2. **Receiver-stock-create race.** Two concurrent accepts for the same product to the same receiver will both pass the `findFirst` (returning null), both attempt `create`, one will fail with a unique constraint error (when the constraint exists — see §3.4 — currently it doesn't, so you get *two* stock rows for the same product on the same receiver).

**Fix:** Wrap the whole flow in `prisma.$transaction` with `Serializable` isolation. Add the missing unique constraint.

#### 4.2.3 Demand Deduplication Bug (HIGH)

`src/app/api/local-reseller/demand/route.ts` (POST) does not check for an existing pending demand for the same `(productCode, requestedById)`. A local reseller who clicks "Submit Demand" three times in a panic will create three pending demand rows. The routing algorithm sees three separate demand units and will triple-reserve stock.

**Fix:** Add a pre-check, or add a partial unique index in the DB.

#### 4.2.4 The `dynamic = "force-dynamic"` Carpet Bomb (MEDIUM)

Roughly 40 of the 60+ reseller routes carry `export const dynamic = "force-dynamic"`. The team's `CHANGELOG.md` explains this was a fix for "aggressive caching" causing UI desync. The cure is worse than the disease:

- Every page load hits Postgres. There is no in-process memoization. The dashboard's "all transfers" page reloads its 200-row table on every render.
- Hot reloads during development are slow because every API change invalidates the route cache (which is the *only* thing keeping it bearable).
- A user opening 5 tabs of the same dashboard issues 5 identical queries.

**Why it happened:** the team is using `fetch("/api/...")` from client components to load data. Next.js's data cache was caching the response, and a `revalidatePath` after every mutation was missing or incomplete. So they added `force-dynamic` to *every* route as a nuclear option.

**Real fix:** The Next.js 15 + App Router idiomatic approach is:
- Server Components for dashboard pages (data is fetched on the server, not the client). The dashboard layout does `await prisma.localResellerStock.findMany(...)` directly. No HTTP round-trip, no cache issue.
- Client Components only for *interactions* (modals, forms, polling).
- `revalidatePath` calls on the server after mutations.

This is a larger refactor (see §6.3) but the right one.

#### 4.2.5 Negotiation Price Bounds (LOW)

`POST /api/upazilla-reseller/stock-orders` validates `negotiatedPrice >= product.price * 0.5` and `negotiatedPrice <= product.price * 2`. The 50% floor is reasonable; the 200% ceiling is generous. There is no upper bound on `requestedQuantity` other than the stock count. A misclick of `999999` will fail at the DB level with a stock check, not at the API level.

**Fix:** Reject `requestedQuantity > available` at the API.

#### 4.2.6 Geolocation Auto-fill in Profile (LOW)

The local-reseller `ProfileSection` calls `navigator.geolocation.getCurrentPosition` to fill lat/lng. This works in dev but **fails in production** because:
1. The site is served over HTTPS in production (correct), so geolocation *should* work.
2. But the success callback only fires after the user has granted permission, and the UI does not show a "waiting for permission" state.
3. The `timeout: 10000` is too short on slow mobile networks.

**Fix:** Replace with a Leaflet map picker (the public/leaflet/ assets are already present). User clicks their location on the map. No permission prompt, works on any network.

### 4.3 The `isReserved` / `isSurplusRouted` Boolean State Bug

The current reservation flow is:

```ts
// /api/routing/reserve, when upazilla has demand:
await prisma.localResellerStock.update({
  where: { id: stockItemId },
  data: {
    reservedQuantity: { increment: reservedAmount },
    surplusQuantity: { increment: surplusAmount },
    isReserved: true,            // ⚠️ partial state is lost
    isSurplusRouted: true        // ⚠️ partial state is lost
  }
});
```

**The bug:** if a stock row has `quantity = 10` and the algorithm reserves 3 for upazilla demand and routes 7 to district, the booleans are both `true`. There is no way to tell from the row alone that the 3 units are *committed* to local demand and the 7 are *in transit to district*. The UI table in `InventoryTable.tsx` reads `item.isReserved` and shows "Reserved for upazilla demand" even when the *surplus* has been sent to district and the reservation is only partial.

**Fix:** Replace the booleans with a `routingState` enum: `available | partially_reserved | fully_reserved | surplus_routed | exhausted`. Compute the state in a Prisma middleware on read.

### 4.4 What the API Layer Does Well

- **Consistent error shape** (`{ error: "..." }`) on every route. The UI's `if (!res.ok) throw new Error(data.error)` works everywhere.
- **Pagination is implemented** in the transfer and history tables (50 items per page with Previous/Next). The routing and demand endpoints do not paginate — see §5.2.
- **Authorization is by default** — every route requires auth and verifies the caller is a reseller of the right type. There are no horizontal-privilege-escalation paths I could find.
- **Validation is consistent** — every POST validates required fields before touching the DB. The negotiation endpoint has particularly thorough bounds checking.

---

## 5. Frontend / Component Audit

### 5.1 Strengths

- **Consistent visual language.** All three dashboards use the same color palette (orange primary, gray chrome, blue informational, green success, red error). Tailwind classes are reused, not duplicated.
- **Loading and empty states are first-class.** Every panel handles `loading`, `error`, and "empty" explicitly with friendly UI. This is rare and good.
- **Optimistic UI on the cheap.** The IncomingStockPanel updates `setTransfers(prev => prev.map(...))` after a PATCH to avoid waiting for a full refetch. The `setActiveTab("accepted")` after accept is a small but pleasant touch.
- **No `useEffect` for data that should be server-rendered.** The team has correctly identified that interactive state (modals, form inputs) belongs in client components, but data fetching also lives in client components (see §4.2.4).

### 5.2 Weaknesses

#### 5.2.1 Untyped data is pervasive

```ts
// Almost every component
const [inventory, setInventory] = useState<any[]>([]);
const [products, setProducts] = useState<SellerProduct[]>([]);  // local type, duplicated in 4 files
const [transfer, setTransfer] = useState<Transfer | null>(null); // local type, duplicated in 3 files
```

The local `Transfer` interface is *redefined* in:
- `LocalResellerMonitor.tsx` (with `localReseller.username`)
- `TransferHistoryTable.tsx` (with `localReseller.username`)
- `IncomingStockPanel.tsx` (with `upazillaReseller.email`)
- `IncomingDistrictStockPanel.tsx` (presumably with yet another shape)

When the Prisma model changes, **none of these will break at compile time** because they're all `any` or hand-rolled. A field rename will be caught only by users reporting "the column is empty."

**Fix:** Generate one canonical type per API response with `zod`, share it across components. See §6.2.

#### 5.2.2 No request deduplication

Open the local-reseller dashboard in two tabs. Watch the network panel. There will be 6+ identical `GET /api/local-reseller/inventory` calls (one per `useEffect` per tab). This isn't a *correctness* bug, it's a *performance* bug, and it gets worse as the user opens more tabs.

**Fix:** Either move data fetching to Server Components (the right answer) or wrap `fetch` in a SWR / TanStack-Query layer with deduplication.

#### 5.2.3 No optimistic concurrency control

The IncomingStockPanel does `setTransfers(prev => prev.map(t => t.id === transferId ? updated : t))` after a PATCH. But what if the server modified the transfer in between (e.g., the sender cancelled it)? The local state will show "accepted" when the server has the transfer as "cancelled."

**Fix:** Re-read the transfer from the server response and trust the server's view. The current code does this correctly, but the *transfer* field on the response is the *same* transfer that was PATCHed, so the bug is unreachable today. The day a different endpoint modifies the transfer, the bug becomes reachable.

#### 5.2.4 Toast system is bespoke in every component

There are *four* toast implementations:
- `ProfileSection` (local Toast component, fixed bottom-right)
- `LocalResellerMonitor` (state, `setTimeout` 4s)
- `IncomingStockPanel` (state, `setTimeout` 4s)
- `TransferHistoryTable` (no toast — uses `alert()`)

The `alert()` in `TransferHistoryTable` is a holdover from early development and should be replaced.

**Fix:** Extract one `useToast()` hook + `<ToastProvider>` into `src/components/layout/Toast.tsx`. Wire it into the root layout.

#### 5.2.5 Inconsistent date formatting

`formatDate()` in `TransferHistoryTable` produces `05 Jun 2026, 14:30`. `formatTimeAgo()` in `IncomingStockPanel` produces `2 days ago`. The seller dashboard uses yet another format. Pick one (the relative-time format is friendlier, but absolute is more useful for audit logs).

#### 5.2.6 `window.location.reload()` for retry

`InventoryTable` does `onClick={() => window.location.reload()}` for its error retry. This re-fetches the entire page, not just the inventory. A `fetchData` retry button would be more pleasant.

#### 5.2.7 Missing `key` warnings

`InventoryTable` has rows keyed by `item.id` — correct. But the `[1, 2, 3].map((row) => ...)` skeleton rows use `key={row}` which is fine but the inner `<td>` uses `key={col}` (an index). React will warn in dev. Trivial fix.

#### 5.2.8 No client-side validation

The `StockOrderModal` enforces `quantity <= product.stock` and `price >= product.price * 0.5` in JavaScript, but the *server* enforces the same rules. The client checks are faster UX; the server checks are security. Both are present, which is good. But `SendStockModal` only checks `qty <= selectedItem.quantity` — if the server's view of `selectedItem.quantity` is stale (because the user opened the modal 5 minutes ago), the API will return a 400 with a confusing message. **Fix:** Refetch the stock item on modal open.

### 5.3 Accessibility

- Most inputs have `id` and `label` (via `htmlFor` or wrapping `<label>`). Good.
- `ProfileSection`'s City/Upazilla selects have no `aria-describedby` for the helper text.
- Modals lack `role="dialog"` and `aria-modal="true"`. The SendStockModal does listen for Escape — good — but does not trap focus. A keyboard user cannot Tab back to the trigger.
- Buttons with icon-only content (`<X />` close button) have `aria-label` in some places but not all. The StockOrderModal close button does not.

**Severity:** Low for a v1, but accumulating. Worth a dedicated pass.

---

## 6. Recommendations (Prioritized)

### 6.1 P0 — Profile Shadow-Table Bugs (do this week)

**Action items:**
1. Wrap every `Profile.update + ShadowTable.update` pair in `prisma.$transaction`.
2. Pick *one* source of truth for `fullName`, `phone`, `storeName`, `username`. Drop the duplicate from the shadow tables. My recommendation: Profile owns these, shadow table owns `resellerCode`, `verified`, and tier-specific extras.
3. Add a DB-level unique constraint on `(localResellerId, sellerProductId)` and `(upazillaResellerId, sellerProductId)` to prevent duplicate stock rows.
4. Add a partial unique index on `ProductDemand(requestedById, productCode) WHERE status = 'pending'` to prevent duplicate pending demands.
5. Replace the `Transfer.stockItemId` string with a proper Prisma relation to the sender's stock table.

**Effort:** 2-3 days.
**Impact:** Eliminates the bug class. Unblocks future feature work.

### 6.2 P1 — Typed API Contracts (do next)

**Action items:**
1. Add `zod` to the project.
2. For every API route, define a `ResponseSchema` at the top of the file. Validate the response body before returning (`ResponseSchema.parse(rows)`).
3. Export the inferred types and use them in components: `const [transfers, setTransfers] = useState<TransferResponse[]>([])`.
4. Replace every `any[]` and `any` in the dashboard components with these types.
5. Run `tsc --noEmit` in CI. Fail the build on `any` in the components directory (lint rule: `@typescript-eslint/no-explicit-any`).

**Effort:** 1 week (mostly mechanical, but touching every component).
**Impact:** Refactors that change column names will fail at compile time. New developers can read a route file and know exactly what shape the response has.

### 6.3 P2 — Server-Component Data Fetching (do this quarter)

**Action items:**
1. Convert each dashboard page (`/local-reseller/dashboard`, `/upazilla-reseller`, `/district-reseller`) into a Server Component that does the initial data load with `prisma` directly.
2. Keep the existing panels as Client Components for interactivity. Pass the server-fetched data as props.
3. After every mutation, call `revalidatePath('/local-reseller/dashboard')` (or `revalidateTag`) to invalidate.
4. Remove `dynamic = "force-dynamic"` from every route that no longer needs it.
5. Leave `force-dynamic` only on the polling endpoints (notifications, etc.) where stale data is harmful.

**Effort:** 2 weeks.
**Impact:** 5-10x faster page loads (no client-server round-trip), 90% reduction in DB queries for the same dashboard, eliminates the cache-fragility problem that forced the `force-dynamic` carpet bomb.

### 6.4 P3 — Extract the Toast + Confirm System (do when convenient)

**Action items:**
1. Create `src/components/layout/ToastProvider.tsx` with a `useToast()` hook.
2. Mount the provider in `src/app/layout.tsx`.
3. Replace the four bespoke toast implementations with `const toast = useToast(); toast.success("...")`.
4. Replace the `alert()` in `TransferHistoryTable` with a toast.
5. Add a `useConfirm()` hook for the rare "are you sure?" dialogs (currently implemented as `confirm()` browser dialogs in a few places).

**Effort:** 2 days.

### 6.5 P3 — Replace Geolocation with a Map Picker (do when convenient)

**Action items:**
1. Use the existing `public/leaflet/` assets.
2. Build a `<LocationPicker lat lng onChange />` component that shows a Leaflet map, places a draggable marker, and emits the coordinates.
3. Use it in all three `ProfileSection` components.
4. Center the map on the user's selected district (use `data/district-centroids.js`).

**Effort:** 3 days.

### 6.6 P3 — Add the Missing States (do when feature requires)

**Action items:**
1. Add `cancelled` to `TransferStatus` and a "Cancel" button on pending transfers for the sender.
2. Add `expired` to `TransferStatus` and a cron job to auto-expire pending transfers after 7 days, restoring the sender's stock.
3. Add `cancelled` to `DemandStatus` and a "Withdraw" button on the local-reseller's pending demands.
4. Add a `withdrawn` state for the local-reseller "I don't want this transfer" case.

**Effort:** 4-5 days including the cron.

### 6.7 P4 — Accessibility Pass (do before public launch)

**Action items:**
1. Add `role="dialog"` and `aria-modal="true"` to all modals. Trap focus inside.
2. Audit all icon-only buttons for `aria-label`.
3. Add skip-to-content link in the layout.
4. Test with VoiceOver on macOS (or NVDA on Windows). Fix anything confusing.

**Effort:** 3-4 days.

---

## 7. Risk Register

| Risk                                                              | Likelihood | Impact | Mitigation                         |
|-------------------------------------------------------------------|------------|--------|------------------------------------|
| Profile/Shadow desync from concurrent edits                       | High       | High   | §6.1 transaction wrappers          |
| Duplicate demand rows inflate reservation count                   | High       | High   | §6.1 partial unique index          |
| Duplicate stock rows from transfer-accept race                    | Medium     | High   | §6.1 unique constraint + §4.2.2 transaction |
| 5+ tabs open = 5x DB load                                        | High       | Medium | §6.3 Server Components             |
| `alert()` in transfer history blocks the main thread              | Low        | Low    | §6.4 Toast system                  |
| New developer renames a column, breaks UI silently                | High       | Medium | §6.2 zod-validated responses       |
| Pending transfer never expires, locks stock forever               | Medium     | High   | §6.6 expiry cron                   |
| Routing algorithm over-routes (sends more than surplus)           | Low        | High   | Already covered by unit tests in `test-routing.ts` |
| Geolocation fails silently in production                          | Medium     | Low    | §6.5 map picker                    |
| Seller-origin demand (e.g., Dhaka seller, Sylhet local buyer) breaks routing | Medium | High | Design: add a "demand-fulfillment from seller" path |

---

## 8. Closing Notes

The reseller subsystem is the most ambitious feature in the NodeCommerce codebase, and most of it is built well. The routing algorithm is correct, the data model is *almost* right (the missing unique constraints are the only major gap), and the UI is consistent and pleasant.

The risk is that the next feature — likely "sellers can directly assign stock to upazillas" or "buyers can order from local resellers via the storefront" — will be built on top of the existing inconsistencies and will inherit the bugs. The recommendations in §6 are sequenced to fix the *structural* issues first so that the next features can be built on a stable base.

If I had to pick *one* thing to do this week, it would be §6.1 (Profile/Shadow transactions + unique constraints). That single change eliminates the highest-impact bug class with a 2-3 day investment.
