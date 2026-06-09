"use client";

import { useState, useEffect, useRef } from "react";

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function ProductSearch({
  onProductSelected,
  onCustomSelected,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  // Map of `globalProduct.id` -> { id (sellerProduct), stock, price }
  // for products the current seller already stocks. Filled in by
  // /api/products/search?type=seller so the UI can show a badge and
  // prefill the form for the "update" path.
  const [inInventory, setInInventory] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const debouncedQuery = useDebounce(query, 300);
  const wrapperRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    if (debouncedQuery.length >= 2) {
      setIsLoading(true);
      // `type=seller` switches /api/products/search into "global product" mode:
      // it returns raw `globalProduct` rows (with `id` = globalProduct.id)
      // so the seller dashboard can POST that id as `globalProductId` without
      // tripping the seller_products_globalProductId_fkey FK.
      fetch(`/api/products/search?q=${encodeURIComponent(debouncedQuery)}&type=seller`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error("Search failed");
          return res.json();
        })
        .then((data) => {
          if (isMounted) {
            setResults(data.products || []);
            setInInventory(data.inInventory || {});
            setIsOpen(true);
            setFocusedIndex(-1);
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError" && isMounted) {
            setResults([]);
            setInInventory({});
          }
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    } else {
      setResults([]);
      setInInventory({});
      setIsOpen(false);
    }

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [debouncedQuery]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < results.length ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex === results.length) {
        handleCustomSelect();
      } else if (focusedIndex >= 0 && focusedIndex < results.length) {
        handleSelect(results[focusedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleSelect = (product) => {
    setSelectedProduct(product);
    setIsOpen(false);
    setQuery("");
    // Attach the existing-inventory info (if any) so the parent can
    // prefill the form and pick between POST (new) and PATCH (update).
    onProductSelected({
      ...product,
      existing: inInventory[product.id] || null,
    });
  };

  const handleCustomSelect = () => {
    setIsOpen(false);
    onCustomSelected();
  };

  const handleReset = () => {
    setSelectedProduct(null);
    setQuery("");
    onProductSelected(null);
  };

  if (selectedProduct) {
    const owned = selectedProduct.existing;
    return (
      <div className="border rounded-md p-4 bg-white shadow-sm flex gap-4 items-start relative">
        {selectedProduct.imageUrl ? (
          <img
            src={selectedProduct.imageUrl}
            alt={selectedProduct.name}
            className="w-20 h-20 object-cover rounded-md border"
          />
        ) : (
          <div className="w-20 h-20 bg-gray-100 rounded-md border flex items-center justify-center text-gray-400 text-xs">
            No image
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{selectedProduct.name}</h3>
            {owned && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                ✓ In your inventory
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-1">
            {selectedProduct.brand ? `${selectedProduct.brand} • ` : ""}
            {selectedProduct.category}
          </p>
          {owned && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
              You already sell this product. Submitting new stock/price will
              <strong> update</strong> the existing entry (currently
              {" "}stock {owned.stock} • ৳{owned.price}).
            </p>
          )}
          {selectedProduct.description && (
            <p className="text-sm text-gray-700 line-clamp-2">
              {selectedProduct.description.substring(0, 100)}
              {selectedProduct.description.length > 100 ? "..." : ""}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-sm text-orange-600 hover:text-orange-700 font-medium px-3 py-1 border border-orange-200 rounded-md hover:bg-orange-50 transition-colors"
        >
          Change Product
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          className="w-full px-4 py-3 pl-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 shadow-sm"
          placeholder="Search products... (e.g. Samsung charger, basmati rice)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        </div>
        {isLoading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {isOpen && query.length >= 2 && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden">
          <ul className="max-h-80 overflow-y-auto py-1">
            {results.length === 0 && !isLoading && (
              <li
                className="px-4 py-3 text-sm text-gray-700 cursor-pointer hover:bg-blue-50"
                onClick={handleCustomSelect}
              >
                No matches found — <span className="text-blue-600 font-medium">Add as Custom Product</span>
              </li>
            )}
            {results.map((item, index) => {
              const owned = inInventory[item.id];
              return (
                <li
                  key={item.id}
                  className={`px-4 py-2 cursor-pointer flex gap-3 items-center ${
                    focusedIndex === index ? "bg-orange-50" : "hover:bg-gray-50"
                  }`}
                  onClick={() => handleSelect(item)}
                >
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="w-10 h-10 object-cover rounded bg-gray-100" />
                  ) : (
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                      No img
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {item.name}
                      </p>
                      {owned && (
                        <span
                          title="This product is already in your inventory — submitting will update its stock and price."
                          className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-800 border border-green-200"
                        >
                          ✓ In your inventory
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {item.brand ? `${item.brand} • ` : ""}
                      {item.category}
                      {owned && (
                        <>
                          {" "}• stock {owned.stock} • ৳{owned.price}
                        </>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
            
            {/* Always show Add as Custom Product at the end if we have some results or if it's the only option */}
            {results.length > 0 && (
              <li
                className={`px-4 py-3 text-sm cursor-pointer border-t border-dashed border-gray-200 mt-1 ${
                  focusedIndex === results.length ? "bg-blue-50" : "hover:bg-blue-50"
                }`}
                onClick={handleCustomSelect}
              >
                <span className="text-blue-600 font-medium">+ Add as Custom Product</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
