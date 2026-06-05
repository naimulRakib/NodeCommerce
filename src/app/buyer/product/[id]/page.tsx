import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ProductDetailClient from "@/components/buyer/ProductDetailClient";

export default async function ProductDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const product = await prisma.sellerProduct.findUnique({
    where: { id: params.id, status: "approved" },
    include: {
      globalProduct: true,
      seller: {
        select: { storeName: true, city: true, upazilla: true, sellerCode: true }
      }
    }
  });

  if (!product) {
    notFound();
  }

  const formattedProduct = {
    id: product.id,
    name: product.customName || product.globalProduct?.name || "Unknown Product",
    brand: product.globalProduct?.brand || "",
    category: product.globalProduct?.category || "",
    imageUrl: product.globalProduct?.imageUrl || "",
    description: product.globalProduct?.description || "No description available.",
    price: product.price,
    stock: product.stock,
    seller: product.seller
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <ProductDetailClient product={formattedProduct} />
      </div>
    </div>
  );
}
