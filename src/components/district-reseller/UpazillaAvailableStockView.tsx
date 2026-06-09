"use client";

import { useState, useEffect } from "react";
import { Package, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { useToast } from "@/components/layout/ToastProvider";

export function UpazillaAvailableStockView() {
  const [data, setData] = useState<{ byProduct: any; allStock: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [pullingId, setPullingId] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/district-reseller/upazilla-available-stock");
      if (!res.ok) throw new Error("Failed to fetch available stock from upazillas");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (productName: string) => {
    setExpandedProducts(prev => ({
      ...prev,
      [productName]: !prev[productName]
    }));
  };

  const handlePullStock = async (stockId: string, quantity: number) => {
    setPullingId(stockId);
    try {
      const res = await fetch("/api/district-reseller/pull-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockId, quantity })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to pull stock");
      
      showToast(`Successfully pulled ${quantity} units into your hub.`, "success");
      fetchStock(); // Refresh list
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setPullingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border rounded-xl shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-6" />
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
        {error}
      </div>
    );
  }

  const products = data?.byProduct ? Object.keys(data.byProduct) : [];

  return (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Upazilla Available Stock</h2>
            <p className="text-sm text-gray-500">Post-demand surplus available across your district's upazillas</p>
          </div>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="p-8 text-center bg-gray-50">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No surplus stock available in any upazilla yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {products.map((productName) => {
            const info = data!.byProduct[productName];
            const isExpanded = expandedProducts[productName];

            return (
              <div key={productName} className="p-0">
                {/* Header row (Clickable) */}
                <button
                  onClick={() => toggleExpand(productName)}
                  className="w-full text-left p-6 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900">{productName}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm">
                      <span className="font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
                        Total Available: {info.totalAvailable} units
                      </span>
                      <span className="text-gray-600 font-medium">
                        Price Range: BDT {info.priceRange.min} {info.priceRange.min !== info.priceRange.max ? `— BDT ${info.priceRange.max}` : ""}
                      </span>
                      <span className="text-gray-500 flex items-center gap-1">
                        <MapPin className="w-4 h-4" /> {info.sources.length} Upazilla(s)
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-gray-400">
                    {isExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 bg-gray-50 border-t border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">Available Locations</h4>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {info.sources.map((source: any, idx: number) => (
                        <div key={idx} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-4 h-4 text-blue-500" />
                            <span className="font-bold text-gray-900">{source.upazilla}</span>
                          </div>
                          <div className="text-xs text-gray-500 mb-3 truncate" title={source.upazillaEmail}>
                            {source.upazillaEmail}
                          </div>
                          <div className="flex justify-between items-end border-t border-gray-100 pt-2 mt-2 mb-3">
                            <div>
                              <p className="text-xs text-gray-500">Qty</p>
                              <p className="font-bold text-green-700">{source.availableQty}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Price/Unit</p>
                              <p className="font-semibold text-gray-900">BDT {source.pricePerUnit}</p>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center mt-2 border-t border-gray-100 pt-3">
                            <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                              Code: {source.productCode}
                            </span>
                            <button
                              onClick={() => handlePullStock(source.id, source.availableQty)}
                              disabled={pullingId === source.id}
                              className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              {pullingId === source.id ? (
                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                              ) : "Pull Stock"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
