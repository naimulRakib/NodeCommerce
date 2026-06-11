"use client";

import { useState, useEffect, useCallback } from "react";
import SendStockModal from "./SendStockModal";
import { MetricCard } from "@/components/ui/MetricCard";

interface UpazillaStockItem {
  id: string;
  productName: string;
  category?: string;
  quantity: number;
}

interface UpazillaReseller {
  id: string;
  email: string;
  upazilla: string;
  city: string;
  inventory: UpazillaStockItem[];
  demands?: any[];
}

export default function UpazillaMonitor() {
  const [resellers, setResellers] = useState<UpazillaReseller[]>([]);
  const [district, setDistrict] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState<any>(null);
  const [districtInventory, setDistrictInventory] = useState<any[]>([]);

  const fetchData = useCallback(async (isMounted: boolean = true) => {
    try {
      const res = await fetch("/api/district-reseller/upazilla-resellers");
      if (!res.ok) throw new Error("Failed to load upazilla resellers");
      const data = await res.json();
      if (isMounted) {
        setResellers(data.upazillaResellers);
        setDistrict(data.district);
      }
    } catch (err: any) {
      if (isMounted) setError((err instanceof Error ? err.message : String(err)));
    } finally {
      if (isMounted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
     
    fetchData(isMounted);
    return () => { isMounted = false; };
  }, [fetchData]);

  const fetchInventory = async () => {
    try {
      const res = await fetch("/api/district-reseller/inventory");
      if (res.ok) {
        const data = await res.json();
        setDistrictInventory(data);
      }
    } catch (err) {
      console.error("Failed to load district inventory", err);
    }
  };

  const handleOpenSendStock = (reseller: UpazillaReseller) => {
    setSelectedReseller(reseller);
    fetchInventory().then(() => {
      setIsModalOpen(true);
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white p-6 rounded-lg border border-gray-200 space-y-4 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-6 rounded-lg text-center border border-red-200">
        <p>{error}</p>
        <button onClick={() => fetchData()} className="mt-4 px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-gray-200/60 pb-5">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
          Upazilla Resellers in {district} District
        </h2>
        <div className="w-64">
          <MetricCard
            labelBn="সক্রিয় উপজেলা রিসেলার"
            labelEn="Active Upazilla Resellers"
            value={resellers.length}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            accentColor="var(--nc-primary)"
          />
        </div>
      </div>

      {resellers.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white p-12 text-center text-slate-500 shadow-sm">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-100 to-amber-50 rounded-full flex items-center justify-center mb-4 shadow-inner">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="font-bold text-slate-800 text-lg">No upazilla resellers registered in your district yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {resellers.map((reseller: any) => (
            <div key={reseller.id} className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col justify-between transform hover:-translate-y-1 transition-all duration-300 group">
              <div className="p-6 space-y-5 relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500/5 to-amber-500/5 rounded-bl-full -z-10 transition-transform group-hover:scale-110 duration-500"></div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-lg sm:text-xl truncate max-w-[200px]" title={reseller.email}>{reseller.email}</h3>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500 mt-1">
                      <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {reseller.upazilla}
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100/80 pt-5">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Demands Overview</h4>
                  {!reseller.demands || reseller.demands.length === 0 ? (
                    <p className="text-sm font-medium text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-dashed border-slate-200">No active demands</p>
                  ) : (
                    <div className="overflow-hidden border border-gray-100 rounded-xl bg-white/50 mb-4">
                      <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-orange-50/50">
                          <tr>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-orange-800 uppercase tracking-wider">Product</th>
                            <th className="px-3 py-2 text-right text-[10px] font-bold text-orange-800 uppercase tracking-wider">Demand</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {reseller.demands.map((demand: any) => (
                            <tr key={demand.id} className="hover:bg-white transition-colors">
                              <td className="px-3 py-2 text-xs text-slate-800 font-bold truncate max-w-[120px]" title={demand.productName}>
                                {demand.productName}
                              </td>
                              <td className="px-3 py-2 text-xs text-right whitespace-nowrap">
                                <span className="font-extrabold text-orange-600 mr-1.5">{demand.demandQuantity}</span>
                                {demand.fulfilledQuantity > 0 && (
                                  <span className="text-[10px] text-gray-400 font-medium ml-1">({demand.fulfilledQuantity} filled)</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 mt-4">Inventory Overview</h4>
                  {reseller.inventory.length === 0 ? (
                    <p className="text-sm font-medium text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-dashed border-slate-200">No inventory items yet</p>
                  ) : (
                    <div className="overflow-hidden border border-gray-100 rounded-xl bg-white/50">
                      <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-slate-50/50">
                          <tr>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Product</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category</th>
                            <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {reseller.inventory.map((item: any) => (
                            <tr key={item.id} className="hover:bg-white transition-colors">
                              <td className="px-3 py-2.5 text-xs text-slate-800 font-bold truncate max-w-[120px]" title={item.productName}>
                                {item.productName}
                              </td>
                              <td className="px-3 py-2.5 text-[10px] font-medium text-slate-500 truncate max-w-[80px]">
                                {item.category || "—"}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-right whitespace-nowrap">
                                <span className="font-extrabold text-slate-800 mr-1.5">{item.quantity}</span>
                                {item.quantity === 0 ? (
                                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-red-100 text-red-700 tracking-wider">0</span>
                                ) : item.quantity <= 10 ? (
                                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-amber-100 text-amber-700 tracking-wider">LOW</span>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 bg-gradient-to-b from-transparent to-slate-50/50 border-t border-gray-100/50 flex justify-end">
                <button
                  onClick={() => handleOpenSendStock(reseller)}
                  className="w-full sm:w-auto inline-flex items-center justify-center py-2.5 px-6 rounded-xl shadow-lg shadow-orange-500/20 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 transition-all duration-300 transform group-hover:scale-[1.02]"
                >
                  Send Stock
                  <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedReseller && (
        <SendStockModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedReseller(null);
            fetchData(); // reload on modal close to see updated local stock
          }}
          upazillaReseller={selectedReseller}
          districtInventory={districtInventory}
        />
      )}
    </div>
  );
}
