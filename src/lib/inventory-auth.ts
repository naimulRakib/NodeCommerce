import { prisma } from "@/lib/prisma";

/**
 * Load a seller product and verify it belongs to the authenticated seller.
 * @param {string} productId
 * @param {string} sellerId
 */
export async function getOwnedSellerProduct(productId: any, sellerId: any) {
  const product = await prisma.sellerProduct.findUnique({
    where: { id: productId },
    include: { globalProduct: true },
  });

  if (!product) {
    return { error: "not_found", product: null };
  }

  if (product.sellerId !== sellerId) {
    return { error: "forbidden", product: null };
  }

  return { error: null, product };
}
