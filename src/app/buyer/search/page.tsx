"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/data/categories";
import SearchBar from "@/components/buyer/SearchBar";
import ProductCard from "@/components/buyer/ProductCard";
import { useCart } from "@/lib/cartContext";

export default function BuyerSearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [upazilla, setUpazilla] = useState("");
  const [page, setPage] = useState(1);
  
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const router = useRouter();
  const { addToCart } = useCart();

  // Debounce query input 400ms
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const fetchProducts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (category) params.set("category", category);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (upazilla) params.set("upazilla", upazilla);
      params.set("page", page.toString());

      const res = await fetch(`/api/products/search?${params.toString()}`, { signal });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error (${res.status}): ${text.slice(0, 100)}`);
      }
      const data = await res.json();
      setProducts(data.products || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setError((err instanceof Error ? err.message : String(err)) || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, category, minPrice, maxPrice, upazilla, page]);


  useEffect(() => {
    const controller = new AbortController();
    fetchProducts(controller.signal);
    return () => controller.abort();
  }, [fetchProducts]);

  useEffect(() => {
    // Track page visit
    fetch("/api/buyer/behaviour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "page_visit", payload: { page: "search" } }),
    }).catch(() => {});
  }, []);

  const handleSearch = (val: string) => {
    setQuery(val);
    // page reset handled by debounce effect
  };

  const handleAddToCart = async (product: any) => {
    await addToCart(product.id, 1);
  };

  const handleViewDetail = (product: any) => {
    router.push(`/buyer/product/${product.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="flex-1 w-full flex justify-center sm:justify-start">
            <SearchBar onSearch={handleSearch} initialValue={query} />
          </div>
          <button
            className="sm:hidden w-full flex justify-center items-center gap-2 bg-gray-100 text-gray-700 py-2 rounded-md"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            Filters
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className={`${sidebarOpen ? "block" : "hidden"} lg:block w-full lg:w-64 flex-shrink-0 bg-white p-5 rounded-lg border border-gray-200 h-fit sticky top-24`}>
          <div className="flex justify-between items-center mb-4 lg:hidden">
            <h2 className="text-lg font-bold">Filters</h2>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-500">✕</button>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Category</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="category"
                    checked={category === ""}
                    onChange={() => { setCategory(""); setPage(1); }}
                    className="text-orange-500 focus:ring-orange-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">All Categories</span>
                </label>
                {CATEGORIES.map(cat => (
                  <label key={cat} className="flex items-center">
                    <input
                      type="radio"
                      name="category"
                      checked={category === cat}
                      onChange={() => { setCategory(cat); setPage(1); }}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{cat}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Price Range</h3>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={e => setMinPrice(e.target.value)}
                  onBlur={() => setPage(1)}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500 text-sm"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={e => setMaxPrice(e.target.value)}
                  onBlur={() => setPage(1)}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500 text-sm"
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Location</h3>
              <input
                type="text"
                placeholder="Enter Upazilla"
                value={upazilla}
                onChange={e => setUpazilla(e.target.value)}
                onBlur={() => setPage(1)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500 text-sm"
              />
            </div>
          </div>
        </aside>

        {/* Product Grid */}
        <div className="flex-1 flex flex-col">
          <div className="mb-4 flex items-center justify-between text-sm text-gray-600">
            <span>Showing {products.length} of {total} products</span>
          </div>

          {error ? (
            <div className="flex flex-col items-center justify-center bg-white rounded-lg shadow-sm border border-red-100 p-12 text-center h-full">
              <svg className="w-12 h-12 text-red-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <h3 className="text-lg font-medium text-gray-900 mb-1">Something went wrong</h3>
              <p className="text-sm text-red-500 max-w-sm mb-4">{error}</p>
              <button onClick={() => fetchProducts()} className="px-4 py-2 bg-orange-100 text-orange-700 font-medium rounded-md hover:bg-orange-200 transition">Try Again</button>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse flex flex-col bg-white rounded-lg p-4 shadow-sm border border-gray-100 h-72">
                  <div className="bg-gray-200 h-32 w-full rounded-md mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="mt-auto h-6 bg-gray-200 rounded w-1/3"></div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center h-full">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No products found</h3>
              <p className="text-gray-500 text-sm max-w-sm">We couldn't find anything matching your search. Try adjusting your filters or search terms.</p>
              {(query || category || minPrice || maxPrice || upazilla) && (
                <button
                  onClick={() => {
                    setQuery(""); setCategory(""); setMinPrice(""); setMaxPrice(""); setUpazilla(""); setPage(1);
                  }}
                  className="mt-6 px-4 py-2 bg-orange-100 text-orange-700 font-medium rounded-md hover:bg-orange-200 transition"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {products.map((p: any) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onAddToCart={handleAddToCart}
                    onViewDetail={handleViewDetail}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex justify-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1 border rounded-md disabled:opacity-50 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-1 text-gray-700 font-medium border-y">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1 border rounded-md disabled:opacity-50 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
