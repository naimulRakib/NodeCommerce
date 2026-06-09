"use client";

import { useState, useEffect } from "react";
import { PackageOpen, Check, X } from "lucide-react";

export function AvailableStockPanel() {
  const [stock, setStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/upazilla-reseller/available-stock");
      if (!res.ok) throw new Error("Failed to fetch available stock");
      const data = await res.json();
      setStock(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalProducts = stock.length;
  const totalAvailable = stock.reduce((acc, item) => acc + item.availableQty, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Available Stock (Post-Demand)</h2>
        <p className="text-gray-500 mt-1">
          Stock remaining after demand fulfillment. Visible to your district reseller.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* Summary Bar */}
      {!loading && !error && stock.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-blue-900">
            <PackageOpen className="w-5 h-5 text-blue-600" />
            <span className="font-medium">
              {totalProducts} products
            </span>
          </div>
          <div className="text-blue-900 font-medium">
            <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded-md text-sm mr-2">
              {totalAvailable}
            </span>
            units available to district
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-100 border-b" />
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 border-b flex items-center px-6 gap-4">
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-4 bg-gray-200 rounded w-1/6" />
                <div className="h-4 bg-gray-200 rounded w-1/6" />
                <div className="h-4 bg-gray-200 rounded w-1/6" />
              </div>
            ))}
          </div>
        </div>
      ) : stock.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <PackageOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">No available stock yet.</p>
          <p className="text-gray-400 text-sm mt-1">Place and fulfill orders to see stock here.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b text-sm font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">Code</th>
                  <th className="px-6 py-4">Received</th>
                  <th className="px-6 py-4">Demand Fulfilled</th>
                  <th className="px-6 py-4">Available</th>
                  <th className="px-6 py-4">Price/Unit</th>
                  <th className="px-6 py-4">Visible to District</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stock.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-gray-900">{item.productName}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {item.brand || "No Brand"} • {item.category || "Uncategorized"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {item.productCode}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {item.originalQuantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={item.demandFulfilledQty > 0 ? "text-green-600 font-medium" : "text-gray-500"}>
                        {item.demandFulfilledQty}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={item.availableQty > 0 ? "text-green-600 font-bold bg-green-50 px-2.5 py-1 rounded-md" : "text-gray-400"}>
                        {item.availableQty}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      BDT {item.pricePerUnit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.isVisibleToDistrict ? (
                        <span className="flex items-center gap-1.5 text-green-700 bg-green-50 px-2 py-1 rounded-md text-sm w-fit font-medium border border-green-100">
                          <Check className="w-4 h-4" /> Yes
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-gray-500 bg-gray-100 px-2 py-1 rounded-md text-sm w-fit font-medium">
                          <X className="w-4 h-4" /> No
                        </span>
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
  );
}
