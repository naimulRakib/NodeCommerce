"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, AlertTriangle, CheckCircle, RefreshCcw } from "lucide-react";

export default function DistrictStockOverview({ districtResellerId }) {
  const [stockItems, setStockItems] = useState([]);
  const [demandData, setDemandData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      // Run both fetches in parallel
      const [inventoryRes, demandRes] = await Promise.all([
        fetch(`/api/district-reseller/inventory`), // Assumes auth cookie/session handles identity
        fetch(`/api/demand/district?districtResellerId=${districtResellerId}`)
      ]);

      if (!inventoryRes.ok) throw new Error("Failed to fetch inventory");
      if (!demandRes.ok) throw new Error("Failed to fetch demand");

      const inventoryData = await inventoryRes.json();
      const demandResult = await demandRes.json();

      setStockItems(inventoryData);

      // Create a map of product name to demand data for quick lookup
      const demandMap = {};
      if (demandResult.districtDemands) {
        demandResult.districtDemands.forEach((d) => {
          demandMap[d.productName.toLowerCase()] = d;
        });
      }
      setDemandData(demandMap);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [districtResellerId]);

  useEffect(() => {
    if (districtResellerId) {
      fetchData();
      
      // Auto-refresh every 60 seconds
      const intervalId = setInterval(() => {
        fetchData();
      }, 60000);
      
      return () => clearInterval(intervalId);
    }
  }, [districtResellerId, fetchData]);

  if (loading && !lastUpdated) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center border border-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
        <AlertTriangle className="w-5 h-5 mr-2" />
        {error}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
      <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
          <Package className="w-5 h-5 mr-2 text-blue-500" />
          District Hub Stock Overview
        </h2>
        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
          <RefreshCcw className="w-3 h-3 mr-1" />
          Updated: {lastUpdated?.toLocaleTimeString()}
        </div>
      </div>

      {stockItems.length === 0 ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          No surplus stock has arrived at the district hub yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
            <thead className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
              <tr>
                <th className="px-4 py-3 font-medium">Product Name</th>
                <th className="px-4 py-3 font-medium text-right">Stock in Hub</th>
                <th className="px-4 py-3 font-medium text-right">District Demand</th>
                <th className="px-4 py-3 font-medium text-right">Remaining Need</th>
                <th className="px-4 py-3 font-medium text-right">Surplus Avail.</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {stockItems.map((item) => {
                const demand = demandData[item.productName.toLowerCase()] || { totalDemand: 0, remainingDemand: 0 };
                const surplusAvailable = Math.max(0, item.quantity - demand.remainingDemand);
                
                let statusBadge = null;
                if (item.quantity >= demand.totalDemand) {
                  statusBadge = (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle className="w-3 h-3 mr-1" /> Demand Covered
                    </span>
                  );
                } else if (item.quantity >= demand.remainingDemand && item.quantity < demand.totalDemand) {
                  statusBadge = (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                      Partially Covered
                    </span>
                  );
                } else if (item.quantity < demand.remainingDemand) {
                  const deficit = demand.remainingDemand - item.quantity;
                  statusBadge = (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      Deficit: {deficit} units
                    </span>
                  );
                }

                return (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-200">
                      {item.productName}
                      {item.brand && <span className="block text-xs text-gray-500 font-normal">{item.brand}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {demand.totalDemand}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${demand.remainingDemand > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-500'}`}>
                      {demand.remainingDemand}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${surplusAvailable > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                      {surplusAvailable}
                    </td>
                    <td className="px-4 py-3">
                      {statusBadge}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
