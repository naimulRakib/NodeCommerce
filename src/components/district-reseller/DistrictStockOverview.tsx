"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, Search, Send, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import SendToUpazillaModal from "./SendToUpazillaModal";
import { UpazillaAvailableStockView } from "./UpazillaAvailableStockView";
import { useToast } from "@/components/layout/ToastProvider";
import { MetricCard } from "@/components/ui/MetricCard";

interface DistrictStockItem {
  id: string;
  productName: string;
  quantity: number;
}

interface DistrictDemand {
  id: string;
  productName: string;
  totalDemand: number;
  remainingDemand: number;
}

interface MergedInventoryRow {
  stockItem: DistrictStockItem;
  demand: DistrictDemand | null;
  surplusAvailable: number;
  coverageStatus: "no_demand" | "covered" | "partial" | "deficit";
}

export default function DistrictStockOverview({ districtResellerId }: { districtResellerId?: string }) {
  const [inventoryRows, setInventoryRows] = useState<MergedInventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<DistrictStockItem | null>(null);
  const [selectedSurplus, setSelectedSurplus] = useState(0);
  const { showToast } = useToast();

  const fetchBoth = useCallback(async () => {
    try {
      const [invRes, demRes] = await Promise.all([
        fetch("/api/district-reseller/inventory"),
        fetch(districtResellerId ? `/api/demand/district?districtResellerId=${districtResellerId}` : "/api/demand/district")
      ]);

      if (!invRes.ok) throw new Error("Failed to load inventory");
      
      const stockItems: DistrictStockItem[] = await invRes.json();
      let demands: DistrictDemand[] = [];
      
      if (demRes.ok) {
        const demData = await demRes.json();
        // The API returns { districtDemands, upazillaBreakdown }
        demands = demData.districtDemands || [];
      } else if (demRes.status !== 400) {
        // Only throw if it's an unexpected error, 400 means it needs districtResellerId
        console.warn("Demand fetch failed with status:", demRes.status);
      }

      // Merge Logic
      const merged: MergedInventoryRow[] = stockItems.map(stock => {
        const match = demands.find(d => d.productName.toLowerCase() === stock.productName.toLowerCase());
        
        const surplusAvailable = Math.max(0, stock.quantity - (match?.remainingDemand ?? 0));
        
        let coverageStatus: MergedInventoryRow["coverageStatus"] = "no_demand";
        if (match) {
          if (stock.quantity >= match.totalDemand) {
            coverageStatus = "covered";
          } else if (stock.quantity >= match.remainingDemand) {
             coverageStatus = "partial";
          } else {
             coverageStatus = "deficit";
          }
        }

        return {
          stockItem: stock,
          demand: match || null,
          surplusAvailable,
          coverageStatus
        };
      });

      setInventoryRows(merged);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [districtResellerId]);

  useEffect(() => {
    let isMounted = true;
    
    const runFetch = async () => {
      if (!isMounted) return;
      await fetchBoth();
    };

    runFetch();
    const interval = setInterval(runFetch, 60000);
    
    return () => { 
      isMounted = false;
      clearInterval(interval);
    };
  }, [districtResellerId, fetchBoth]);

  const openModal = (stockItem: DistrictStockItem, surplus: number) => {
    setSelectedStockItem(stockItem);
    setSelectedSurplus(surplus);
    setModalOpen(true);
  };

  const handleModalSuccess = (msg: string) => {
    showToast(msg, "success");
    fetchBoth();
  };

  const coveredCount = inventoryRows.filter(r => r.coverageStatus === "covered").length;
  const deficitCount = inventoryRows.filter(r => r.coverageStatus === "deficit").length;
  const totalSurplus = inventoryRows.reduce((sum, r) => sum + r.surplusAvailable, 0);

  return (
    <div className="space-y-6 relative">
      <SendToUpazillaModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        stockItem={selectedStockItem}
        surplusAvailable={selectedSurplus}
        onSuccess={handleModalSuccess}
      />

      {/* Summary Bar */}
      {!loading && !error && inventoryRows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            labelBn="ইনভেন্টরি আইটেম"
            labelEn="Products in Hub"
            value={inventoryRows.length}
            icon={<Package className="w-5 h-5" />}
            accentColor="var(--nc-primary)"
          />
          <MetricCard
            labelBn="চাহিদা পূরণ"
            labelEn="Covered"
            value={coveredCount}
            icon={<CheckCircle2 className="w-5 h-5" />}
            accentColor="var(--nc-success)"
          />
          <MetricCard
            labelBn="ঘাটতি"
            labelEn="In Deficit"
            value={deficitCount}
            icon={<AlertCircle className="w-5 h-5" />}
            accentColor="var(--nc-warning)"
          />
          <MetricCard
            labelBn="মোট উদ্বৃত্ত"
            labelEn="Total Surplus Available"
            value={totalSurplus}
            icon={<Send className="w-5 h-5" />}
            accentColor="var(--nc-info)"
          />
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-600" />
            District Stock Overview
          </h3>
          <button 
            onClick={fetchBoth}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1.5"
          >
            {loading && <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>}
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-200">
                <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Hub Stock</th>
                <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total Demand</th>
                <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Remaining Demand</th>
                <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Surplus</th>
                <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && inventoryRows.length === 0 ? (
                // Skeletons
                Array(4).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-6"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="py-4 px-6"><div className="h-4 bg-gray-200 rounded w-12 ml-auto"></div></td>
                    <td className="py-4 px-6"><div className="h-4 bg-gray-200 rounded w-12 ml-auto"></div></td>
                    <td className="py-4 px-6"><div className="h-4 bg-gray-200 rounded w-12 ml-auto"></div></td>
                    <td className="py-4 px-6"><div className="h-4 bg-gray-200 rounded w-12 ml-auto"></div></td>
                    <td className="py-4 px-6"><div className="h-6 bg-gray-200 rounded-full w-24 mx-auto"></div></td>
                    <td className="py-4 px-6"><div className="h-8 bg-gray-200 rounded-md w-28 ml-auto"></div></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-red-600 font-medium">
                    {error}
                  </td>
                </tr>
              ) : inventoryRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100 shadow-sm">
                      <Package className="w-8 h-8 text-gray-400" />
                    </div>
                    <h4 className="text-gray-900 font-bold text-lg mb-1">No stock in district hub yet.</h4>
                    <p className="text-gray-500">Stock will appear here when local sellers route surplus upwards.</p>
                  </td>
                </tr>
              ) : (
                inventoryRows.map((row) => (
                  <tr key={row.stockItem.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 font-bold text-gray-900">{row.stockItem.productName}</td>
                    <td className="py-4 px-6 text-right font-black text-gray-800">{row.stockItem.quantity}</td>
                    <td className="py-4 px-6 text-right font-medium text-gray-600">
                      {row.demand?.totalDemand ?? "—"}
                    </td>
                    <td className="py-4 px-6 text-right font-bold">
                      {row.demand?.remainingDemand ? (
                        <span className="text-red-600">{row.demand.remainingDemand}</span>
                      ) : "—"}
                    </td>
                    <td className="py-4 px-6 text-right font-bold">
                      {row.surplusAvailable > 0 ? (
                        <span className="text-green-600">{row.surplusAvailable}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {row.coverageStatus === "covered" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200 whitespace-nowrap">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Demand Covered
                        </span>
                      ) : row.coverageStatus === "partial" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200 whitespace-nowrap">
                          <Clock className="w-3.5 h-3.5" /> Partially Covered
                        </span>
                      ) : row.coverageStatus === "deficit" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 whitespace-nowrap">
                          <AlertCircle className="w-3.5 h-3.5" /> Deficit: {(row.demand?.totalDemand ?? 0) - row.stockItem.quantity} units
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                          No Demand Entered
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {row.surplusAvailable > 0 && (
                        <button 
                          onClick={() => openModal(row.stockItem, row.surplusAvailable)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition shadow-sm whitespace-nowrap"
                        >
                          Send to Upazilla →
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <UpazillaAvailableStockView />
      </div>
    </div>
  );
}
