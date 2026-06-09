"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

export default function DemandPanel({ districtResellerId }) {
  const [data, setData] = useState({ districtDemands: [], upazillaBreakdown: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [expandedProducts, setExpandedProducts] = useState({});
  const [showOverride, setShowOverride] = useState(false);

  // Override Form State
  const [productName, setProductName] = useState("");
  const [totalDemand, setTotalDemand] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/demand/district?districtResellerId=${districtResellerId}`);
      if (!res.ok) throw new Error("Failed to fetch district demands");
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [districtResellerId]);

  useEffect(() => {
    if (districtResellerId) {
      fetchData();
    }
  }, [districtResellerId, fetchData]);

  const toggleProduct = (product) => {
    setExpandedProducts(prev => ({
      ...prev,
      [product]: !prev[product]
    }));
  };

  const handleOverride = async (e) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/demand/district", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          totalDemand: parseInt(totalDemand, 10)
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to override district demand");
      }

      setProductName("");
      setTotalDemand("");
      setShowOverride(false);
      fetchData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-gray-200 rounded-lg dark:bg-gray-700"></div>
        <div className="h-64 bg-gray-200 rounded-lg dark:bg-gray-700"></div>
      </div>
    );
  }

  const { districtDemands, upazillaBreakdown } = data;

  if (districtDemands.length === 0 && Object.keys(upazillaBreakdown).length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
        No upazilla demands have been entered for your district yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SECTION 1 & 2: District Demand Summary & Upazilla Breakdown */}
      <div className="space-y-4">
        {Object.keys(upazillaBreakdown).sort().map((product) => {
          const productData = upazillaBreakdown[product];
          const isExpanded = !!expandedProducts[product];
          const fulfilled = productData.totalDemand - productData.remainingDemand;
          const pct = productData.totalDemand > 0 ? (fulfilled / productData.totalDemand) * 100 : 0;

          let barColor = "bg-red-500";
          if (pct >= 80) barColor = "bg-green-500";
          else if (pct >= 50) barColor = "bg-yellow-500";

          // Calculate an overall status badge
          let statusLabel = "Pending";
          let statusColor = "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
          
          if (productData.totalDemand > 0) {
            if (productData.remainingDemand === 0) {
              statusLabel = "Fulfilled";
              statusColor = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
            } else if (fulfilled > 0) {
              statusLabel = "Partial";
              statusColor = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
            }
          }

          return (
            <div key={product} className="bg-white rounded-lg shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
              {/* Header */}
              <div 
                className="p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 flex flex-col md:flex-row md:items-center justify-between"
                onClick={() => toggleProduct(product)}
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{product}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                      {statusLabel}
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-gray-200 rounded-full dark:bg-gray-700 mt-2 max-w-md">
                    <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }}></div>
                  </div>
                  
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 flex flex-wrap gap-4">
                    <span>
                      <span className="font-semibold text-gray-900 dark:text-gray-200">{fulfilled} / {productData.totalDemand}</span> units fulfilled from seller stock
                    </span>
                    {productData.remainingDemand > 0 ? (
                      <span className="text-red-600 font-medium dark:text-red-400">
                        {productData.remainingDemand} units still needed
                      </span>
                    ) : (
                      <span className="text-green-600 font-medium dark:text-green-400">
                        Fully covered
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 md:mt-0 ml-4 flex items-center justify-center text-gray-400">
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>

              {/* Upazilla Breakdown Table */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Upazilla Breakdown</h4>
                  {productData.upazillas.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          <tr>
                            <th className="px-3 py-2 font-medium">Upazilla</th>
                            <th className="px-3 py-2 font-medium text-right">Demand</th>
                            <th className="px-3 py-2 font-medium text-right">Fulfilled from Sellers</th>
                            <th className="px-3 py-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {productData.upazillas.map((u, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-200">{u.upazilla}</td>
                              <td className="px-3 py-2 text-right">{u.demandQuantity}</td>
                              <td className={`px-3 py-2 text-right ${u.fulfilledQuantity > 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                                {u.fulfilledQuantity}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded text-xs
                                  ${u.status === 'fulfilled' ? 'text-green-700 dark:text-green-400' :
                                    u.status === 'partially_fulfilled' ? 'text-yellow-700 dark:text-yellow-400' :
                                    'text-gray-500 dark:text-gray-400'}`}>
                                  {u.status.replace("_", " ")}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No active demands in upazillas.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* SECTION 3: Manual Override */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 overflow-hidden mt-8">
        <button 
          onClick={() => setShowOverride(!showOverride)}
          className="w-full p-4 text-left font-semibold text-gray-700 dark:text-gray-200 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50"
        >
          <span>Override District Demand</span>
          {showOverride ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        
        {showOverride && (
          <div className="p-6 border-t border-gray-100 dark:border-gray-700">
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800 flex items-start dark:bg-yellow-900/30 dark:border-yellow-900/50 dark:text-yellow-200">
              <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
              <p>Warning: Manual overrides replace auto-calculated totals from upazillas. Use only if you need to buffer demand above what upazillas requested.</p>
            </div>
            
            <form onSubmit={handleOverride} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Demand</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="1000000"
                  value={totalDemand}
                  onChange={(e) => setTotalDemand(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isSubmitting ? "Overriding..." : "Override"}
              </button>
            </form>
            
            {formError && (
              <div className="text-red-600 text-sm mt-3 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {formError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
