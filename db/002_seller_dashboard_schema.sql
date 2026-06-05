-- Seller dashboard schema (run after 001_create_profiles.sql or migrate via Prisma)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS "fullName" TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS "sellerCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_seller_code_key ON profiles ("sellerCode");

CREATE TABLE IF NOT EXISTS global_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT NOT NULL,
  "subCategory" TEXT,
  description TEXT,
  "imageUrl" TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seller_products (
  id TEXT PRIMARY KEY,
  "sellerId" TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  "globalProductId" TEXT REFERENCES global_products (id) ON DELETE SET NULL,
  "customName" TEXT,
  stock INTEGER NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  "rejectionReason" TEXT,
  "qrCode" TEXT,
  "productCode" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS seller_products_seller_id_idx ON seller_products ("sellerId");
CREATE INDEX IF NOT EXISTS seller_products_status_idx ON seller_products (status);
