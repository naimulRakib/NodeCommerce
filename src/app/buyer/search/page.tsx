"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/data/categories";
import SearchBar from "@/components/buyer/SearchBar";
import ProductCard from "@/components/buyer/ProductCard";
import { useCart } from "@/lib/cartContext";
import ProductSearchPanel from "@/components/delivery/ProductSearchPanel";
import { useLanguage } from "@/contexts/LanguageContext";
import styles from "./ShopPage.module.css";
import Image from "next/image";

export default function BuyerSearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const { t } = useLanguage();
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
    <div className={styles.shopPage}>
      <div className={styles.shopHero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>
            {t("আপনার পণ্য খুঁজুন", "Find Your Products")}
          </h1>
          <p className={styles.heroSubtitle}>
            {t(
              "বাংলাদেশের সেরা পণ্য, সেরা দামে",
              "Best products at the best prices"
            )}
          </p>
          <div className={styles.heroSearchWrapper}>
            <SearchBar onSearch={handleSearch} initialValue={query} />
          </div>
        </div>
      </div>

      <div className={styles.shopBody}>
        <div className={styles.categoryScroll}>
          <button
            className={`${styles.categoryPill} ${category === "" ? styles.categoryPillActive : ""}`}
            onClick={() => { setCategory(""); setPage(1); }}
          >
            {t("সব ক্যাটাগরি", "All Categories")}
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c}
              className={`${styles.categoryPill} ${category === c ? styles.categoryPillActive : ""}`}
              onClick={() => { setCategory(c); setPage(1); }}
            >
              {c}
            </button>
          ))}
        </div>

        <div className={styles.shopToolbar}>
          <span className={styles.resultCount}>
            {t(
              `${total}টি পণ্য পাওয়া গেছে`,
              `${total} products found`
            )}
          </span>
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-red-500">
            {error}
          </div>
        ) : loading ? (
           <div className={styles.productGrid}>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="nc-skeleton h-64 w-full"></div>
              ))}
           </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
             {t("কোনো পণ্য পাওয়া যায়নি", "No products found")}
          </div>
        ) : (
          <>
            <div className={styles.productGrid}>
              {products.map(p => (
                <div
                  key={p.id}
                  className={styles.productCard}
                  onClick={() => handleViewDetail(p)}
                >
                  <div className={styles.productImageWrapper}>
                    <div className="relative w-full h-full bg-gray-100 flex items-center justify-center text-4xl">
                      {p.category === 'Rice' ? '🍚' :
                       p.category === 'Vegetables' ? '🥕' :
                       p.category === 'Fruits' ? '🍎' :
                       p.category === 'Fish' ? '🐟' :
                       p.category === 'Meat' ? '🥩' :
                       p.category === 'Spices' ? '🌶️' : '📦'}
                    </div>
                    <span className={`${styles.stockBadge}
                      ${p.stock > 10 ? styles.inStock :
                        p.stock > 0 ? styles.lowStock :
                        styles.outOfStock}`}
                    >
                      {p.stock > 10
                        ? t("মজুদ আছে", "In Stock")
                        : p.stock > 0
                        ? t("কম মজুদ", "Low Stock")
                        : t("মজুদ শেষ", "Out of Stock")}
                    </span>
                  </div>

                  <div className={styles.productInfo}>
                    <span className={styles.productCode}>
                      {p.productCode || p.id.substring(0, 8)}
                    </span>
                    <h3 className={styles.productName}>
                      {t(p.nameBn || p.name, p.name)}
                    </h3>
                    <span className={styles.productLocation}>
                      {p.seller?.user?.profile?.businessName || p.sellerLocation || 'Local Vendor'}
                      {p.distanceKm && ` · ${p.distanceKm} কিমি`}
                    </span>
                    <div className={styles.productFooter}>
                      <div>
                        <span className={styles.productPrice}>
                          ৳{p.price}
                        </span>
                        <span className={styles.productPriceUnit}>
                          /{t(p.unitBn || p.unit, p.unit || "unit")}
                        </span>
                      </div>
                      <button
                        className={styles.addToCartButton}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddToCart(p)
                        }}
                        aria-label={t(
                          `${p.name} কার্টে যোগ করুন`,
                          `Add ${p.name} to cart`
                        )}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="nc-btn nc-btn-secondary nc-btn-sm"
                >
                  {t("আগে", "Prev")}
                </button>
                <span className="px-4 py-1 text-gray-700 font-medium">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="nc-btn nc-btn-secondary nc-btn-sm"
                >
                  {t("পরে", "Next")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
