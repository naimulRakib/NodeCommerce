"use client";

import { useState, useEffect } from "react";
import { Search, Store, Phone, Box, X, ChevronRight } from "lucide-react";
import { SellerProductCard } from "./SellerProductCard";
import { StockOrderModal } from "./StockOrderModal";

export function SellersPanel({ upazillaName }: { upazillaName: string }) {
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Drawer state
  const [selectedSeller, setSelectedSeller] = useState<any | null>(null);
  const [sellerProducts, setSellerProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  // Modal state
  const [orderingProduct, setOrderingProduct] = useState<any | null>(null);

  useEffect(() => {
    fetchSellers();
  }, []);

  const fetchSellers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/upazilla-reseller/sellers");
      if (!res.ok) throw new Error("Failed to fetch sellers");
      const data = await res.json();
      setSellers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openSellerProducts = async (seller: any) => {
    setSelectedSeller(seller);
    setLoadingProducts(true);
    setProductsError(null);
    setSellerProducts([]);

    try {
      const res = await fetch(`/api/upazilla-reseller/sellers/${seller.id}/products`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch products");
      }
      const data = await res.json();
      setSellerProducts(data);
    } catch (err: any) {
      setProductsError(err.message);
    } finally {
      setLoadingProducts(false);
    }
  };

  const closeSellerProducts = () => {
    setSelectedSeller(null);
  };

  const filteredSellers = sellers.filter((s) =>
    s.storeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sellers in {upazillaName}</h2>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {sellers.length} sellers registered
            </span>
          </div>
        </div>
        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="Search sellers by store name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border rounded-xl p-4 flex gap-4 animate-pulse">
              <div className="w-16 h-16 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-3 py-1">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
                <div className="h-8 bg-gray-200 rounded w-full mt-4" />
              </div>
            </div>
          ))}
        </div>
      ) : sellers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Store className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">No sellers registered in {upazillaName} yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSellers.map((seller) => (
            <div key={seller.id} className="bg-white border rounded-xl p-5 flex flex-col hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl flex-shrink-0">
                  {seller.avatarUrl ? (
                    <img src={seller.avatarUrl} alt={seller.storeName} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    seller.storeName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg text-gray-900 truncate" title={seller.storeName}>
                    {seller.storeName}
                  </h3>
                  <div className="mt-1 flex flex-col gap-1">
                    <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600 w-fit">
                      {seller.sellerCode}
                    </span>
                    {seller.phone && (
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {seller.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-auto flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium bg-green-50 text-green-700 border border-green-100">
                  <Box className="w-4 h-4" />
                  {seller._count.products} products available
                </span>
                
                <button
                  onClick={() => openSellerProducts(seller)}
                  className="text-blue-600 font-medium hover:text-blue-700 hover:underline flex items-center gap-1"
                >
                  View Products <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Seller Products Drawer (Overlay) */}
      {selectedSeller && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                  {selectedSeller.storeName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{selectedSeller.storeName}</h3>
                  <p className="text-xs text-gray-500">Products List</p>
                </div>
              </div>
              <button onClick={closeSellerProducts} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-gray-50/50">
              {loadingProducts ? (
                <div className="flex justify-center items-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : productsError ? (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg">{productsError}</div>
              ) : sellerProducts.length === 0 ? (
                <div className="text-center py-10">
                  <Box className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No approved products with stock available.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {sellerProducts.map((product) => (
                    <SellerProductCard
                      key={product.id}
                      product={product}
                      onOrderClick={() => setOrderingProduct(product)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stock Order Modal */}
      {orderingProduct && selectedSeller && (
        <StockOrderModal
          product={orderingProduct}
          seller={selectedSeller}
          onClose={() => setOrderingProduct(null)}
          onSuccess={() => {
            // Optional: refresh products to show updated stock if needed, 
            // but stock isn't deducted until fulfilled.
          }}
        />
      )}
    </div>
  );
}
