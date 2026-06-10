# UiPath Edge Cases Tasks

- `[x]` 1. Security & Validation
  - `[x]` Add `X-UiPath-Secret` validation to `risk-assessment`, `approval`, and `vendor-score` APIs
  - `[x]` Add strict JSON payload validation (400 Bad Request) to APIs
- `[x]` 2. Concurrency Control
  - `[x]` Rewrite `approval` API to use atomic Prisma updates (`sourceApproved: false` condition) to prevent race conditions
- `[x]` 3. Hanging Job Sweeper
  - `[x]` Create `/api/aco/expire-shipments` to auto-reject shipments pending for > 8 hours
- `[x]` 4. Truck Breakdown
  - `[x]` Create `/api/uipath/truck-failure` to handle emergency truck failures and rerouting
