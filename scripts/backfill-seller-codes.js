/**
 * One-time backfill: assign sellerCode to every profile that is missing one.
 * Usage: node scripts/backfill-seller-codes.js
 */
import { PrismaClient } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

async function uniqueSellerCode(prisma) {
  for (let i = 0; i < 50; i++) {
    const code = randomCode();
    const taken = await prisma.profile.findUnique({
      where: { sellerCode: code },
      select: { id: true },
    });
    if (!taken) return code;
  }
  throw new Error("Could not generate unique seller code");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Use: npm run backfill:seller-codes");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const missing = await prisma.profile.findMany({
    where: {
      OR: [{ sellerCode: null }, { sellerCode: "" }],
    },
    select: { id: true, storeName: true },
  });

  console.log(`Found ${missing.length} profile(s) without a seller code.`);

  for (const row of missing) {
    const sellerCode = await uniqueSellerCode(prisma);
    await prisma.profile.update({
      where: { id: row.id },
      data: { sellerCode },
    });
    console.log(`  ${row.storeName || row.id} → ${sellerCode}`);
  }

  await prisma.$disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
