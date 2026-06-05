"use client";

import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cartContext";
import ProductCard from "./ProductCard";

export default function RecentProductsGrid({ products }: { products: any[] }) {
  const router = useRouter();
  const { addToCart } = useCart();

  const handleAddToCart = (product: any) => {
    addToCart(product.id, 1);
  };

  const handleViewDetail = (product: any) => {
    router.push(`/buyer/product/${product.id}`);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          onAddToCart={handleAddToCart}
          onViewDetail={handleViewDetail}
        />
      ))}
    </div>
  );
}
