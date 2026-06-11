'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCart } from '@/lib/cartContext'; // assuming standard cart context exists, or mock it

type SearchResult = {
  resellerId: string;
  resellerName: string;
  resellerCode: string;
  distanceLabel: string;
  stockItemId: string;
  productCode: string;
  productName: string;
  brand: string;
  quantity: number;
  price: number;
};

export default function ProductSearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyerLocation, setBuyerLocation] = useState<{ lat: number, lng: number } | null>(null);
  
  const isMounted = useRef(true);
  const { cartItems, addToCart, clearCart } = useCart?.() || { cartItems: [], addToCart: () => {}, clearCart: () => {} };

  useEffect(() => {
    isMounted.current = true;
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          if (isMounted.current) {
            setBuyerLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            });
            setError(null);
          }
        },
        err => {
          if (isMounted.current) {
            setError("GPS required for local search. Please enable GPS.");
          }
        }
      );
    } else {
      setError("Geolocation is not supported by this browser.");
    }

    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchResults = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }
    
    setLoading(true);
    try {
      const latParam = buyerLocation ? `&lat=${buyerLocation.lat}` : '';
      const lngParam = buyerLocation ? `&lng=${buyerLocation.lng}` : '';
      
      const res = await fetch(`/api/delivery/search?query=${encodeURIComponent(searchQuery)}${latParam}${lngParam}&radius=5`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to search');
      
      if (isMounted.current) {
        setResults(data.results || []);
      }
    } catch (err: any) {
      if (isMounted.current) setError(err.message);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [buyerLocation]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchResults(query);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, fetchResults]);

  const handleAddToCart = (item: SearchResult) => {
    if (cartItems && cartItems.length > 0) {
      const currentReseller = cartItems[0].resellerId;
      if (currentReseller && currentReseller !== item.resellerId) {
        const replace = window.confirm('Cart এ অন্য reseller এর item আছে। Replace করবেন? (Cart contains items from another reseller. Replace?)');
        if (replace) {
          clearCart();
          addToCart(item);
        }
        return;
      }
    }
    addToCart(item);
  };

  return (
    <div className="p-4 bg-white shadow-md rounded-lg max-w-2xl mx-auto mt-4">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Local Delivery Search</h2>
      
      {error && (
        <div className="bg-yellow-100 text-yellow-800 p-3 rounded mb-4 flex items-center">
          <span className="mr-2">📍</span>
          {error}
        </div>
      )}

      <div className="relative mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products nearby (e.g., rice, oil)..."
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={!buyerLocation && !error}
        />
        {loading && <div className="absolute right-3 top-3 animate-spin text-blue-500">⏳</div>}
      </div>

      <div className="space-y-4">
        {results.map((item, idx) => (
          <div key={idx} className="border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-gray-50 transition-colors">
            <div className="mb-3 sm:mb-0">
              <div className="text-sm text-gray-500 mb-1 flex items-center">
                <span className="mr-1">🏪</span> {item.resellerName} 
                <span className="mx-2">|</span> 
                <span className="text-blue-600 font-medium">📍 {item.distanceLabel} দূরে</span>
              </div>
              <h3 className="font-semibold text-lg text-gray-800">{item.productName} <span className="text-xs text-gray-400 font-normal">({item.productCode})</span></h3>
              <div className="text-sm text-gray-600 mt-1">Available: <span className="font-medium text-gray-800">{item.quantity}</span> units</div>
              <div className="text-md font-bold text-green-600 mt-1">BDT {item.price.toFixed(2)}</div>
            </div>
            <button 
              onClick={() => handleAddToCart(item)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors w-full sm:w-auto"
            >
              Cart এ যোগ করো 🛒
            </button>
          </div>
        ))}

        {!loading && query.length >= 2 && results.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No products found nearby. Try increasing the radius or searching something else.
          </div>
        )}
      </div>
    </div>
  );
}
