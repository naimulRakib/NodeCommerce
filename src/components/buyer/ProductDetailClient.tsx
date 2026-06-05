"use client";

import { useState, useEffect } from "react";
import { useCart } from "@/lib/cartContext";

export default function ProductDetailClient({ product }: { product: any }) {
  const [qty, setQty] = useState(1);
  const { addToCart } = useCart();
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    // Track behaviour on mount
    fetch("/api/buyer/behaviour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "view_product",
        payload: { productId: product.id, productName: product.name, category: product.category }
      })
    }).catch(() => {});
  }, [product.id, product.name, product.category]);

  const handleAddToCart = async () => {
    if (product.stock < 1) return;
    setAdding(true);
    await addToCart(product.id, qty);
    setAdding(false);
  };

  const isOutOfStock = product.stock === 0;

  return (
    <div className="flex flex-col md:flex-row">
      {/* Image Gallery */}
      <div className="md:w-1/2 p-8 md:p-12 flex items-center justify-center bg-gray-50 border-b md:border-b-0 md:border-r border-gray-100">
        <div className="w-full max-w-md aspect-w-1 aspect-h-1 bg-white rounded-xl shadow-sm overflow-hidden flex items-center justify-center">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
          ) : (
            <div className="text-gray-400">No Image Available</div>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="md:w-1/2 p-8 md:p-12 flex flex-col">
        <div className="mb-2 text-sm text-gray-500 font-medium">
          {product.brand && <span className="text-orange-600 mr-2">{product.brand}</span>}
          <span>{product.category}</span>
        </div>

        <h1 className="text-3xl font-black text-gray-900 mb-4 leading-tight">{product.name}</h1>
        
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
          <div className="text-4xl font-black text-orange-600">৳{product.price.toLocaleString("en-BD")}</div>
          {product.stock > 0 && product.stock <= 5 && (
            <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded-full border border-orange-200">
              Only {product.stock} left
            </span>
          )}
          {isOutOfStock && (
            <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full border border-red-200">
              Out of Stock
            </span>
          )}
        </div>

        <div className="prose prose-sm text-gray-600 mb-8 max-w-none">
          <p>{product.description}</p>
        </div>

        {/* Add to Cart Actions */}
        <div className="mt-auto pt-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex items-center border border-gray-300 rounded-md bg-white w-fit">
              <button
                disabled={qty <= 1 || isOutOfStock}
                onClick={() => setQty(q => q - 1)}
                className="px-4 py-3 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition"
              >
                -
              </button>
              <span className="px-6 py-3 font-medium text-gray-900 border-x border-gray-200 min-w-[3rem] text-center">
                {qty}
              </span>
              <button
                disabled={qty >= product.stock || isOutOfStock}
                onClick={() => setQty(q => q + 1)}
                className="px-4 py-3 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition"
              >
                +
              </button>
            </div>
            
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock || adding}
              className="flex-1 bg-orange-600 text-white font-bold py-3 px-8 rounded-md hover:bg-orange-700 transition disabled:opacity-50 shadow-sm flex justify-center items-center gap-2"
            >
              {adding ? (
                "Adding..."
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  {isOutOfStock ? "Out of Stock" : "Add to Cart"}
                </>
              )}
            </button>
          </div>

          {/* Seller Card */}
          <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center font-bold text-gray-400 border border-gray-200">
                {product.seller.storeName[0]?.toUpperCase()}
              </div>
              <div>
                <h4 className="font-bold text-gray-900">{product.seller.storeName}</h4>
                <p className="text-sm text-gray-500">{product.seller.city}, {product.seller.upazilla}</p>
              </div>
              <div className="ml-auto text-right text-xs text-gray-400">
                <p>Seller ID</p>
                <p className="font-mono">{product.seller.sellerCode}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
