"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import SendStockModal from "./SendStockModal";

interface ResellerStockItem {
  id: string;
  quantity: number;
  sellerProduct: {
    customName: string | null;
    globalProduct: {
      name: string;
      category: string | null;
    } | null;
  } | null;
  customName: string | null;
  isReserved?: boolean;
  reservedQuantity?: number;
  surplusQuantity?: number;
}

interface LocalReseller {
  id: string;
  username: string;
  resellerCode: string;
  city: string;
  upazilla: string;
  stock: ResellerStockItem[];
}

interface UpazillaStockItem {
  id: string;
  productName: string;
  quantity: number;
}

export default function LocalResellerMonitor() {
  const [resellers, setResellers] = useState<LocalReseller[]>([]);
  const [upazillaInventory, setUpazillaInventory] = useState<UpazillaStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState<LocalReseller | null>(null);

  // Routing State
  const [routingLoaders, setRoutingLoaders] = useState<Record<string, boolean>>({});
  const [routingErrors, setRoutingErrors] = useState<Record<string, string>>({});
  const [districtWarning, setDistrictWarning] = useState<string | null>(null);
  
  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (message: string, type: "success" | "error") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async (isMounted: boolean = true) => {
    setLoading(true);
    try {
      const [resellersRes, inventoryRes] = await Promise.all([
        fetch("/api/upazilla-reseller/local-resellers"),
        fetch("/api/upazilla-reseller/inventory")
      ]);

      if (!resellersRes.ok) throw new Error("Failed to load local resellers");
      if (!inventoryRes.ok) throw new Error("Failed to load inventory");

      const resellersData = await resellersRes.json();
      const inventoryData = await inventoryRes.json();
      
      if (isMounted) {
        setResellers(resellersData);
        setUpazillaInventory(inventoryData);
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

  const handleOpenModal = (reseller: LocalReseller) => {
    setSelectedReseller(reseller);
    setIsModalOpen(true);
  };

  const handleTransferSuccess = () => {
    if (selectedReseller) {
      showToast(`Stock sent! Waiting for ${selectedReseller.username} to accept.`, "success");
    }
    // Refresh inventory and resellers to reflect deducted upazilla stock and possible pending state
    fetchData();
  };

  const handleRunReservation = async (item: ResellerStockItem) => {
    setRoutingLoaders(prev => ({ ...prev, [item.id]: true }));
    setRoutingErrors(prev => ({ ...prev, [item.id]: "" }));
    setDistrictWarning(null);

    const productName = item.customName || item.sellerProduct?.customName || item.sellerProduct?.globalProduct?.name || "";

    try {
      const res = await fetch("/api/routing/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockItemId: item.id,
          productName,
          availableQuantity: item.quantity
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error && (data.error.includes("No district reseller found") || data.error.includes("No district mapping found"))) {
          setDistrictWarning(`Cannot route surplus: ${data.error}. Seller stock will remain at upazilla level.`);
        } else {
          setRoutingErrors(prev => ({ ...prev, [item.id]: data.error || "Failed to reserve" }));
        }
        return;
      }

      if (data.action === "reserved") {
        showToast(`${data.reservedQuantity} units reserved for upazilla demand. ${data.surplusQuantity} units sent to district hub.`, "success");
      } else if (data.action === "no_demand") {
        showToast(`No upazilla demand found for this product. All ${data.surplusQuantity} units sent to district.`, "success");
      } else if (data.action === "partial") {
        showToast(`${data.reservedQuantity} units reserved for upazilla demand. ${data.surplusQuantity} units sent to district hub.`, "success");
      }

      fetchData(true);
    } catch (err: any) {
      setRoutingErrors(prev => ({ ...prev, [item.id]: err.message || "Network error" }));
    } finally {
      setRoutingLoaders(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const handleSendToDistrict = async (item: ResellerStockItem) => {
    setRoutingLoaders(prev => ({ ...prev, [item.id]: true }));
    setRoutingErrors(prev => ({ ...prev, [item.id]: "" }));
    setDistrictWarning(null);

    try {
      const res = await fetch("/api/routing/surplus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockItemId: item.id,
          quantity: item.surplusQuantity
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setRoutingErrors(prev => ({ ...prev, [item.id]: data.error || "Failed to send surplus" }));
        return;
      }

      showToast(`Successfully sent ${item.surplusQuantity} surplus units to district.`, "success");
      fetchData(true);
    } catch (err: any) {
      setRoutingErrors(prev => ({ ...prev, [item.id]: err.message || "Network error" }));
    } finally {
      setRoutingLoaders(prev => ({ ...prev, [item.id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-3">
              <div className="h-10 bg-gray-100 rounded w-full"></div>
              <div className="h-10 bg-gray-100 rounded w-full"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg text-center">
        <p>{error}</p>
        <button onClick={() => fetchData()} className="mt-4 px-4 py-2 bg-white rounded shadow-sm text-sm font-medium hover:bg-gray-50">Retry</button>
      </div>
    );
  }

  if (resellers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
          🏪
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No Local Resellers</h3>
        <p className="text-gray-500">No local resellers found in your upazilla.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg font-medium text-white transition-opacity ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {toast.message}
        </div>
      )}

      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-4 sm:mb-6">Local Reseller Network</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-md p-4 sm:p-6 text-white flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-xs font-medium uppercase tracking-wider mb-1">Total Resellers</p>
              <h3 className="text-3xl sm:text-4xl font-black">{resellers.length}</h3>
            </div>
            <div className="text-4xl sm:text-5xl opacity-20 flex-shrink-0">🏪</div>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md p-4 sm:p-6 text-white flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs font-medium uppercase tracking-wider mb-1">Total Stock Deployed</p>
              <h3 className="text-3xl sm:text-4xl font-black">
                {resellers.reduce((total, reseller) => total + reseller.stock.reduce((st, item) => st + item.quantity, 0), 0)}
              </h3>
            </div>
            <div className="text-4xl sm:text-5xl opacity-20 flex-shrink-0">📦</div>
          </div>
        </div>
      </div>

      {districtWarning && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg shadow-sm flex items-start">
          <svg className="w-5 h-5 mr-3 mt-0.5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          <p className="font-medium text-sm">{districtWarning}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {resellers.map((reseller) => (
          <div key={reseller.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-100 flex flex-col overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex flex-col sm:flex-row justify-between items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 truncate">{reseller.username}</h3>
                <p className="text-sm font-medium text-orange-600 mt-1 flex items-center gap-1 truncate">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  <span className="truncate">{reseller.city}, {reseller.upazilla}</span>
                </p>
              </div>
              <div className="bg-orange-50 px-2 sm:px-3 py-1.5 rounded-lg border border-orange-100 text-xs font-bold text-orange-800 shadow-sm flex flex-col items-center flex-shrink-0">
                <span className="text-[9px] uppercase text-orange-500 mb-0.5">Code</span>
                <span className="text-xs truncate">{reseller.resellerCode}</span>
              </div>
            </div>

            <div className="p-4 sm:p-5 flex-grow overflow-x-auto">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Current Stock</h4>
              
              {reseller.stock.length === 0 ? (
                <div className="text-sm text-gray-500 italic py-4 text-center bg-gray-50 rounded border border-dashed border-gray-200">
                  No stock assigned yet
                </div>
              ) : (
                <div className="border border-gray-200 rounded-md overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-4 py-2 text-left font-medium text-gray-500 text-xs">Product Name</th>
                        <th className="hidden sm:table-cell px-4 py-2 text-left font-medium text-gray-500 text-xs">Category</th>
                        <th className="px-3 sm:px-4 py-2 text-right font-medium text-gray-500 text-xs">Qty</th>
                        <th className="px-3 sm:px-4 py-2 text-left font-medium text-gray-500 text-xs">Routing Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reseller.stock.map((item) => {
                        const sp = item.sellerProduct;
                        const name = item.customName || sp?.customName || sp?.globalProduct?.name || "Unknown Product";
                        const category = sp?.globalProduct?.category || "—";
                        
                        return (
                          <tr key={item.id} className="hover:bg-gray-50 group border-b border-gray-100 last:border-0 flex-col">
                            <td className="px-3 sm:px-4 py-3 align-top font-medium text-gray-900 text-xs sm:text-sm">{name}</td>
                            <td className="hidden sm:table-cell px-4 py-3 align-top text-gray-500 text-xs sm:text-sm">{category}</td>
                            <td className="px-3 sm:px-4 py-3 align-top text-right">
                              <span className={`font-bold text-xs sm:text-sm ${item.quantity === 0 ? 'text-red-600' : item.quantity <= 3 ? 'text-orange-600' : 'text-gray-900'}`}>
                                {item.quantity}
                              </span>
                              {item.quantity === 0 && (
                                <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-800 inline-block">OOS</span>
                              )}
                            </td>
                            <td className="px-3 sm:px-4 py-3 align-top text-left w-full sm:w-auto">
                              {/* Routing logic states */}
                              <div className="flex flex-col items-start min-w-[200px]">
                                {item.isReserved ? (
                                  <div className="bg-green-50 px-2 py-1.5 rounded border border-green-100 w-full">
                                    <div className="flex items-center text-xs font-semibold text-green-800">
                                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                      Reserved: {item.reservedQuantity} units for upazilla demand
                                    </div>
                                    <div className="text-[10px] text-green-600 mt-0.5 ml-4.5">
                                      Surplus: {item.surplusQuantity} sent to district hub
                                    </div>
                                  </div>
                                ) : item.surplusQuantity && item.surplusQuantity > 0 ? (
                                  item.reservedQuantity === 0 ? (
                                    <div className="bg-blue-50 px-2 py-1.5 rounded border border-blue-100 w-full">
                                      <div className="flex items-center text-xs font-semibold text-blue-800">
                                        <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        No local demand
                                      </div>
                                      <div className="text-[10px] text-blue-600 mt-0.5 ml-4.5">
                                        {item.quantity} sent to district
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="w-full">
                                      <div className="text-xs font-semibold text-yellow-600 mb-1">
                                        {item.surplusQuantity} surplus remaining
                                      </div>
                                      <button 
                                        onClick={() => handleSendToDistrict(item)}
                                        disabled={routingLoaders[item.id] || item.quantity === 0}
                                        className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-medium py-1 px-2 rounded transition flex items-center shadow-sm disabled:opacity-50"
                                      >
                                        {routingLoaders[item.id] ? "Processing..." : "Send to District"}
                                      </button>
                                    </div>
                                  )
                                ) : (
                                  <button
                                    onClick={() => handleRunReservation(item)}
                                    disabled={routingLoaders[item.id] || item.quantity === 0}
                                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-1.5 px-3 rounded transition flex items-center shadow-sm border border-gray-200 disabled:opacity-50"
                                  >
                                    {routingLoaders[item.id] ? (
                                      <><span className="w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin mr-1"></span> Processing...</>
                                    ) : (
                                      "Run Reservation"
                                    )}
                                  </button>
                                )}
                              </div>
                              {routingErrors[item.id] && (
                                <div className="text-xs text-red-600 mt-1 mt-2">
                                  {routingErrors[item.id]}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => handleOpenModal(reseller)}
                className="px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs sm:text-sm font-bold rounded-lg hover:from-orange-600 hover:to-orange-700 transition shadow-md flex items-center gap-2 whitespace-nowrap"
              >
                Send Stock 
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <SendStockModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        localReseller={selectedReseller}
        upazillaInventory={upazillaInventory}
        onSuccess={handleTransferSuccess}
      />
    </div>
  );
}
