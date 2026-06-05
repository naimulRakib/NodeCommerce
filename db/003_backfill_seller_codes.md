# Backfill seller codes

Seller codes are assigned automatically by the app when:

- A new seller registers (`POST /api/seller/register`)
- A seller signs in and profile sync runs
- A seller opens the dashboard (`GET /api/seller/profile`)

Existing rows with a missing `sellerCode` are filled on the next login or dashboard visit.

To backfill all profiles at once (optional), run from the project root:

```bash
node scripts/backfill-seller-codes.js
```

Requires `DATABASE_URL` in `.env`.
