"use client";

import { useState, useEffect } from "react";
import { Globe, MapPin, Search } from "lucide-react";
import { useToast } from "@/components/layout/ToastProvider";

interface SurplusItem {
  id: string;
  productName: string;
  brand: string | null;
  category: string | null;
  surplusAvailable: number;
  districtResellerId: string;
  districtReseller: {
    district: string;
    email: string;
  };
}

export default function NationalSurplusView() {
  const [surplusItems, setSurplusItems] = useState<SurplusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [pullingId, setPullingId] = useState<string | null>(null);
  const [pullQuantity, setPullQuantity] = useState<Record<string, string>>({});
  const { showToast } = useToast();

  const fetchSurplus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/district-reseller/national-surplus");
      if (!res.ok) throw new Error("Failed to load national surplus");
      const data = await res.json();
      setSurplusItems(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSurplus();
  }, []);

  const handlePullStock = async (item: SurplusItem) => {
    const qtyStr = pullQuantity[item.id] || String(item.surplusAvailable);
    const qty = parseInt(qtyStr, 10);
    
    if (isNaN(qty) || qty < 1) {
      showToast("Please enter a valid quantity.", "error");
      return;
    }

    if (qty > item.surplusAvailable) {
      showToast(`You can only pull up to ${item.surplusAvailable} units.`, "error");
      return;
    }

    setPullingId(item.id);
    try {
      const res = await fetch("/api/district-reseller/national-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromDistrictResellerId: item.districtResellerId,
          stockItemId: item.id,
          quantity: qty
        })
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to pull stock");
      
      showToast(`Successfully pulled ${qty} units of ${item.productName} from ${item.districtReseller.district} district!`, "success");

      // Clear quantity field and refresh list
      setPullQuantity(prev => ({ ...prev, [item.id]: "" }));
      fetchSurplus();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setPullingId(null);
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200/60 pb-5">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Globe className="w-8 h-8 text-blue-500" />
            National Surplus Market
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1.5">
            View and acquire surplus stock from other district hubs across the country.
          </p>
        </div>
        <button 
          onClick={fetchSurplus}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <Search className="w-4 h-4" />
          )}
          Refresh Market
        </button>
      </div>

      {loading && surplusItems.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border rounded-xl p-6 shadow-sm animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-6"></div>
              <div className="space-y-2 mb-4">
                <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                <div className="h-4 bg-gray-100 rounded w-3/4"></div>
              </div>
              <div className="h-10 bg-gray-200 rounded mt-4"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-6 rounded-lg border border-red-200 text-center">
          <p>{error}</p>
        </div>
      ) : surplusItems.length === 0 ? (
        <div className="bg-white border rounded-xl shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
            <Globe className="w-8 h-8 text-blue-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">No National Surplus Available</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            There is currently no surplus stock available from other district hubs. Check back later.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {surplusItems.map(item => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="p-5 border-b border-gray-100 bg-gradient-to-br from-white to-gray-50/50">
                <h3 className="font-bold text-lg text-gray-900 mb-1">{item.productName}</h3>
                <p className="text-xs text-gray-500 font-medium">
                  {item.brand || "Unknown Brand"} • {item.category || "Uncategorized"}
                </p>
              </div>
              
              <div className="p-5 flex-grow space-y-4">
                <div className="flex items-center gap-2 bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
                  <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Source District</p>
                    <p className="text-sm font-semibold text-gray-900">{item.districtReseller.district}</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Available Surplus</p>
                    <p className="text-2xl font-black text-green-600">{item.surplusAvailable}</p>
                  </div>
                  <div className="text-right">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Quantity to Pull</label>
                    <input 
                      type="number"
                      min="1"
                      max={item.surplusAvailable}
                      value={pullQuantity[item.id] !== undefined ? pullQuantity[item.id] : item.surplusAvailable}
                      onChange={(e) => setPullQuantity({ ...pullQuantity, [item.id]: e.target.value })}
                      className="w-20 text-right px-2 py-1.5 border border-gray-300 rounded text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
              
              <div className="p-5 pt-0 mt-auto">
                <button
                  onClick={() => handlePullStock(item)}
                  disabled={pullingId === item.id}
                  className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pullingId === item.id ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Globe className="w-4 h-4" />
                      Acquire Stock
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
