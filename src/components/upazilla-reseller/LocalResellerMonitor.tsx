"use client";

import { useState, useEffect, useCallback } from "react";
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
  
  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
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
      if (isMounted) setError(err.message);
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

      <div className="mb-8">
        <h2 className="text-2xl font-extrabold text-gray-900 mb-6">Local Reseller Network</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-md p-6 text-white flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium uppercase tracking-wider mb-1">Total Resellers</p>
              <h3 className="text-4xl font-black">{resellers.length}</h3>
            </div>
            <div className="text-5xl opacity-20">🏪</div>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md p-6 text-white flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium uppercase tracking-wider mb-1">Total Stock Deployed</p>
              <h3 className="text-4xl font-black">
                {resellers.reduce((total, reseller) => total + reseller.stock.reduce((st, item) => st + item.quantity, 0), 0)}
              </h3>
            </div>
            <div className="text-5xl opacity-20">📦</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {resellers.map((reseller) => (
          <div key={reseller.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-100 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex justify-between items-start">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900">{reseller.username}</h3>
                <p className="text-sm font-medium text-orange-600 mt-1 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  {reseller.city}, {reseller.upazilla}
                </p>
              </div>
              <div className="bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 text-xs font-bold text-orange-800 shadow-sm flex flex-col items-center">
                <span className="text-[9px] uppercase text-orange-500 mb-0.5">Code</span>
                {reseller.resellerCode}
              </div>
            </div>

            <div className="p-5 flex-grow">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Current Stock</h4>
              
              {reseller.stock.length === 0 ? (
                <div className="text-sm text-gray-500 italic py-4 text-center bg-gray-50 rounded border border-dashed border-gray-200">
                  No stock assigned yet
                </div>
              ) : (
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Product Name</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Category</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reseller.stock.map((item) => {
                        const sp = item.sellerProduct;
                        const name = item.customName || sp?.customName || sp?.globalProduct?.name || "Unknown Product";
                        const category = sp?.globalProduct?.category || "—";
                        
                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-900">{name}</td>
                            <td className="px-4 py-2 text-gray-500">{category}</td>
                            <td className="px-4 py-2 text-right">
                              <span className={`font-bold ${item.quantity === 0 ? 'text-red-600' : item.quantity <= 3 ? 'text-orange-600' : 'text-gray-900'}`}>
                                {item.quantity}
                              </span>
                              {item.quantity === 0 && (
                                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">Out of Stock</span>
                              )}
                              {item.quantity > 0 && item.quantity <= 3 && (
                                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800">Low Stock</span>
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

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => handleOpenModal(reseller)}
                className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-bold rounded-lg hover:from-orange-600 hover:to-orange-700 transition shadow-md flex items-center gap-2"
              >
                Send Stock 
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
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
