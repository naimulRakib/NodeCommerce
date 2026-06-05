import { prisma } from "@/lib/prisma";

const CODE_LENGTH = 6;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = CODE_LENGTH) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/**
 * @param {() => Promise<boolean>} isTaken
 * @param {number} [maxAttempts]
 */
async function generateUniqueCode(isTaken, maxAttempts = 25) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = randomCode();
    if (!(await isTaken(code))) {
      return code;
    }
  }
  throw new Error("Could not generate a unique code");
}

/**
 * Random 6-char alphanumeric seller code (unique in profiles.sellerCode).
 * @returns {Promise<string>}
 */
export async function generateSellerCode() {
  return generateUniqueCode(async (code) => {
    const existing = await prisma.profile.findUnique({
      where: { sellerCode: code },
      select: { id: true },
    });
    return Boolean(existing);
  });
}

/**
 * Random 6-char alphanumeric reseller code (unique in local_resellers.resellerCode).
 * @returns {Promise<string>}
 */
export async function generateResellerCode() {
  return generateUniqueCode(async (code) => {
    const existing = await prisma.localReseller.findUnique({
      where: { resellerCode: code },
      select: { id: true },
    });
    return Boolean(existing);
  });
}

/**
 * Random 6-char alphanumeric product code (unique in seller_products.productCode).
 * @returns {Promise<string>}
 */
export async function generateProductCode() {
  return generateUniqueCode(async (code) => {
    const existing = await prisma.sellerProduct.findUnique({
      where: { productCode: code },
      select: { id: true },
    });
    return Boolean(existing);
  });
}
