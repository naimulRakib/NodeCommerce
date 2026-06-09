import { Prisma } from "@/generated/prisma";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";

/** Default code length for the various *Code columns. */
export const CODE_LENGTH = 8;

/** Generates an 8-character alphanumeric code. */
export function generateCode(): string {
  return nanoid(CODE_LENGTH);
}

/** @deprecated Use `generateCode` instead. */
export function generateSellerCode(): string {
  return generateCode();
}

/**
 * Run `insertFn(code)` until a code that does not collide with an existing
 * row is produced. We rely on Prisma's unique-violation error code `P2002`
 * rather than doing a SELECT-then-INSERT, which is racy under concurrent
 * writers (e.g. two signups happening in the same millisecond).
 *
 * @param insertFn async function that performs the actual write; it MUST
 *   throw a `PrismaClientKnownRequestError` with `code === "P2002"` if the
 *   code collides.
 * @param generate  optional function to produce a candidate code. Defaults
 *   to `nanoid(8)`.
 * @param maxTries  cap on retries. Defaults to 50. With nanoid(8)'s ~10^14
 *   keyspace this is overwhelmingly enough; the cap exists to surface a
 *   genuine bug rather than spin forever.
 */
export async function generateUniqueCode<T>(
  insertFn: (code: string) => Promise<T>,
  generate: () => string = generateCode,
  maxTries = 50,
): Promise<T> {
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const code = generate();
    try {
      return await insertFn(code);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // collision — try again
        continue;
      }
      throw err;
    }
  }
  throw new Error(
    `generateUniqueCode: gave up after ${maxTries} attempts (extreme collision rate?)`,
  );
}

/**
 * Random 8-char alphanumeric reseller code (unique in local_resellers.resellerCode).
 * Performs the real create inside the retry loop so collisions are surfaced
 * as a Prisma P2002 error, not raced against by a separate read.
 * @returns {Promise<string>}
 */
export async function generateResellerCode(): Promise<string> {
  return generateUniqueCode(async (code) => {
    // Throws Prisma P2002 on collision; the helper catches and retries.
    const row = await prisma.localReseller.create({
      data: {
        id: `tmp-${code}`,
        email: `tmp-${code}@placeholder.local`,
        username: `tmp-${code}`,
        city: "__pending__",
        upazilla: "__pending__",
        resellerCode: code,
      },
      select: { id: true, resellerCode: true },
    });
    // Clean up the placeholder row by the *real* id we just got back.
    // If the caller crashes between our create and theirs, the row
    // remains identifiable by its `tmp-` email prefix and is safe to ignore.
    await prisma.localReseller.delete({ where: { id: row.id } });
    return row.resellerCode;
  });
}

/**
 * Generate an 8-char alphanumeric product code that is unique within
 * `seller_products.productCode`. Requires the *real* `sellerId` because the
 * column has a non-nullable FK to `Profile`; we cannot use the placeholder-
 * row pattern from `generateResellerCode` here.
 *
 * The function does the real `sellerProduct.create` inside the retry loop.
 * If the `productCode` collides, Prisma surfaces `P2002` and we try again
 * with a fresh code. On success we return the `productCode` AND the freshly
 * created row's `id`, so the caller can use the same row instead of
 * re-creating it.
 *
 * @returns {Promise<{ id: string; productCode: string }>}
 */
export async function generateProductCodeForSeller(
  sellerId: string,
): Promise<{ id: string; productCode: string }> {
  return generateUniqueCode(async (code) => {
    const row = await prisma.sellerProduct.create({
      data: {
        sellerId,
        customName: "__pending__",
        stock: 0,
        price: 0,
        productCode: code,
        qrCode: code,
        status: "pending",
      },
      select: { id: true, productCode: true },
    });
    return { id: row.id, productCode: row.productCode };
  });
}

/**
 * @deprecated Use `generateProductCodeForSeller(sellerId)` instead. The
 * zero-arg variant cannot work because `SellerProduct.sellerId` is a
 * non-nullable FK to `Profile` and a placeholder row would violate it.
 */
export async function generateProductCode(): Promise<string> {
  throw new Error(
    "generateProductCode() is deprecated: pass the real sellerId to " +
      "generateProductCodeForSeller(sellerId) instead. The placeholder " +
      "pattern used for reseller codes cannot work for SellerProduct " +
      "because sellerId is a non-nullable FK to Profile.",
  );
}
