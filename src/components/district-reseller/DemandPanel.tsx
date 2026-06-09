"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, AlertCircle, Settings, CheckCircle2, Clock } from "lucide-react";

interface UpazillaDemandBreakdown {
  upazilla: string;
  demandQuantity: number;
  fulfilledQuantity: number;
  status: string;
}

interface ProductBreakdown {
  totalDemand: number;
  remainingDemand: number;
  upazillas: UpazillaDemandBreakdown[];
}

interface DistrictDemand {
  id: string;
  productName: string;
  totalDemand: number;
  remainingDemand: number;
}

export default function DemandPanel({ districtResellerId }: { districtResellerId: string }) {
  const [districtDemands, setDistrictDemands] = useState<DistrictDemand[]>([]);
  const [upazillaBreakdown, setUpazillaBreakdown] = useState<Record<string, ProductBreakdown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded state
  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Record<string, boolean>>({});
  const [showOverride, setShowOverride] = useState(false);

  // Override Form
  const [overrideProduct, setOverrideProduct] = useState("");
  const [overrideQuantity, setOverrideQuantity] = useState("");
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [overriding, setOverriding] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchDemands = async () => {
      try {
        const res = await fetch(`/api/demand/district?districtResellerId=${districtResellerId}`);
        if (!res.ok) throw new Error("Failed to load demand data.");
        const data = await res.json();
        if (isMounted) {
          setDistrictDemands(data.districtDemands || []);
          setUpazillaBreakdown(data.upazillaBreakdown || {});
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    if (districtResellerId) fetchDemands();
    return () => { isMounted = false; };
  }, [districtResellerId]);

  const fetchDemandsAfterOverride = async () => {
    try {
      const res = await fetch(`/api/demand/district?districtResellerId=${districtResellerId}`);
      if (!res.ok) throw new Error("Failed to load demand data.");
      const data = await res.json();
      setDistrictDemands(data.districtDemands || []);
      setUpazillaBreakdown(data.upazillaBreakdown || {});
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToastMsg = (message: string, type: "success" | "error") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  };

  const toggleBreakdown = (productName: string) => {
    setExpandedBreakdowns(prev => ({
      ...prev,
      [productName]: !prev[productName]
    }));
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOverrideError(null);
    
    if (!overrideProduct.trim()) {
      setOverrideError("Product Name is required.");
      return;
    }
    const qty = parseInt(overrideQuantity);
    if (isNaN(qty) || qty < 0) {
      setOverrideError("Total Demand must be a positive number.");
      return;
    }

    setOverriding(true);
    try {
      const res = await fetch("/api/demand/district", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: overrideProduct.trim(), totalDemand: qty })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to override demand");
      }
      
      showToastMsg(`Demand for ${overrideProduct} updated to ${qty}`, "success");
      setOverrideProduct("");
      setOverrideQuantity("");
      await fetchDemandsAfterOverride();
    } catch (err: any) {
      setOverrideError(err.message);
    } finally {
      setOverriding(false);
    }
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-bold text-red-800">Failed to load demand data.</h3>
        </div>
        <p className="text-red-600 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-red-100 text-red-800 font-medium rounded-md hover:bg-red-200 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg font-medium text-white transition-opacity ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">District Demand Planning</h2>
          <p className="text-sm text-gray-500 mt-1">Aggregate view of demands across all upazillas in your district.</p>
        </div>
      </div>

      {/* SECTION 2 - Manual Override (Collapsible) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button 
          onClick={() => setShowOverride(!showOverride)}
          className="w-full px-6 py-4 flex items-center justify-between bg-gray-50/50 hover:bg-gray-100/50 transition"
        >
          <div className="flex items-center gap-2 text-gray-800 font-bold">
            <Settings className="w-5 h-5 text-gray-500" />
            ⚙ Override District Demand
          </div>
          {showOverride ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>
        
        {showOverride && (
          <div className="p-6 border-t border-gray-100">
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3 text-yellow-800">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium">
                ⚠ Manual overrides replace auto-calculated totals. Use only for anticipated demand spikes.
              </p>
            </div>
            
            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Product Name</label>
                  <input
                    type="text"
                    value={overrideProduct}
                    onChange={(e) => setOverrideProduct(e.target.value)}
                    placeholder="e.g. Rice"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Total Demand</label>
                  <input
                    type="number"
                    min="0"
                    value={overrideQuantity}
                    onChange={(e) => setOverrideQuantity(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  {overrideError && <p className="text-red-500 text-xs font-medium mt-1">{overrideError}</p>}
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={overriding}
                  className="px-6 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 focus:ring-4 focus:ring-gray-200 transition-all disabled:opacity-70 flex items-center gap-2"
                >
                  {overriding ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : "Apply Override"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* SECTION 1 - District Demand Overview */}
      <div className="space-y-4">
        {loading ? (
          // Skeletons
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded-full w-full mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-32"></div>
            </div>
          ))
        ) : districtDemands.length === 0 ? (
          // Empty State
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100 shadow-sm">
              <AlertCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-gray-900 font-bold text-lg mb-1">No upazilla demands have been entered for your district yet.</h4>
            <p className="text-gray-500">Wait for upazilla resellers to submit their requirements.</p>
          </div>
        ) : (
          districtDemands.map((demand) => {
            const fulfilledByUpazillas = Math.max(0, demand.totalDemand - demand.remainingDemand);
            const percentFilled = demand.totalDemand > 0 ? (fulfilledByUpazillas / demand.totalDemand) * 100 : 100;
            const cappedPercent = Math.min(100, Math.max(0, percentFilled));
            
            let barColorClass = "bg-red-500";
            if (percentFilled >= 80) barColorClass = "bg-green-500";
            else if (percentFilled >= 50) barColorClass = "bg-yellow-500";

            let statusBadge = null;
            if (demand.remainingDemand <= 0) {
               statusBadge = <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">✓ Fulfilled</span>;
            } else if (fulfilledByUpazillas > 0) {
               statusBadge = <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">◑ Partial</span>;
            } else {
               statusBadge = <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-800 border border-gray-200">⏳ Pending</span>;
            }

            const breakdown = upazillaBreakdown[demand.productName];
            const sortedUpazillas = breakdown?.upazillas ? [...breakdown.upazillas].sort((a, b) => {
               if (a.status === "pending" && b.status !== "pending") return -1;
               if (a.status !== "pending" && b.status === "pending") return 1;
               return 0;
            }) : [];

            return (
              <div key={demand.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-black text-gray-900">{demand.productName}</h3>
                    {statusBadge}
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full ${barColorClass} transition-all duration-500`} 
                      style={{ width: `${cappedPercent}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <div className="font-semibold text-gray-700">
                      {fulfilledByUpazillas} / {demand.totalDemand} units
                    </div>
                    {demand.remainingDemand > 0 && (
                      <div className="text-red-600 font-bold">
                        {demand.remainingDemand} units still needed
                      </div>
                    )}
                  </div>
                </div>

                {/* View Breakdown Toggle */}
                {sortedUpazillas.length > 0 && (
                  <div className="border-t border-gray-100">
                    <button 
                      onClick={() => toggleBreakdown(demand.productName)}
                      className="w-full px-6 py-3 flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition"
                    >
                      {expandedBreakdowns[demand.productName] ? (
                        <>Hide Breakdown <ChevronUp className="w-4 h-4" /></>
                      ) : (
                        <>View Breakdown <ChevronDown className="w-4 h-4" /></>
                      )}
                    </button>
                    
                    {/* Expandable Breakdown Table */}
                    {expandedBreakdowns[demand.productName] && (
                      <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
                        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th className="px-4 py-2 font-semibold text-gray-600">Upazilla</th>
                                <th className="px-4 py-2 font-semibold text-gray-600 text-right">Entered</th>
                                <th className="px-4 py-2 font-semibold text-gray-600 text-right">Fulfilled</th>
                                <th className="px-4 py-2 font-semibold text-gray-600 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {sortedUpazillas.map((upz, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50">
                                  <td className="px-4 py-3 font-medium text-gray-800">{upz.upazilla}</td>
                                  <td className="px-4 py-3 text-right text-gray-600">{upz.demandQuantity}</td>
                                  <td className="px-4 py-3 text-right font-medium text-green-600">{upz.fulfilledQuantity}</td>
                                  <td className="px-4 py-3 text-center">
                                    {upz.status === "fulfilled" ? (
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Fulfilled</span>
                                    ) : upz.status === "partially_fulfilled" ? (
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">Partial</span>
                                    ) : (
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 bg-gray-200 px-2 py-0.5 rounded-full">Pending</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
