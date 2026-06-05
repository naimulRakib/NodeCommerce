"use client";

import { useState, useEffect, useCallback } from "react";

interface Transfer {
  id: string;
  quantity: number;
  status: string;
  createdAt: string;
  upazillaReseller: {
    email: string;
    upazilla: string;
  };
  stockItem: {
    productName: string;
    brand: string | null;
    category: string | null;
  };
}

export default function IncomingStockPanel() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "accepted" | "rejected">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchTransfers = useCallback(async (isMounted: boolean = true) => {
    try {
      const res = await fetch("/api/local-reseller/transfers");
      if (!res.ok) throw new Error("Failed to load transfers");
      const data = await res.json();
      if (isMounted) setTransfers(data);
    } catch (err: any) {
      if (isMounted) setError(err.message);
    } finally {
      if (isMounted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchTransfers(isMounted);
    return () => { isMounted = false; };
  }, [fetchTransfers]);

  // Expose pending count globally if needed, or simply render in UI
  const pendingTransfers = transfers.filter(t => t.status === "pending");
  const acceptedTransfers = transfers.filter(t => t.status === "accepted");
  const rejectedTransfers = transfers.filter(t => t.status === "rejected");

  const displayedTransfers = 
    activeTab === "pending" ? pendingTransfers : 
    activeTab === "accepted" ? acceptedTransfers : 
    rejectedTransfers;

  const handleAction = async (transferId: string, action: "accept" | "reject") => {
    setProcessingId(transferId);
    try {
      const res = await fetch("/api/local-reseller/transfers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferId, action })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action}`);
      }

      const updated = await res.json();
      
      // Update local state
      setTransfers(prev => prev.map(t => t.id === transferId ? updated : t));
      
      if (action === "accept") {
        showToast("Stock added to your inventory!", "success");
        setActiveTab("accepted");
      } else {
        showToast("Transfer rejected.", "success");
        setActiveTab("rejected");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return "Just now";
  };

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-6 rounded-lg text-center border border-red-200">
        <p>{error}</p>
        <button onClick={() => fetchTransfers()} className="mt-4 px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200">Retry</button>
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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("pending")}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === "pending"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Pending
            {pendingTransfers.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'pending' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>
                {pendingTransfers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("accepted")}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "accepted"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Accepted
          </button>
          <button
            onClick={() => setActiveTab("rejected")}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "rejected"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Rejected
          </button>
        </nav>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-2/3 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-6"></div>
              <div className="flex justify-between items-end mb-6">
                <div className="h-10 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                <div className="h-4 bg-gray-100 rounded w-1/2"></div>
              </div>
            </div>
          ))
        ) : displayedTransfers.length === 0 ? (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
            <div className="text-gray-400 mb-2">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
            </div>
            <p className="text-gray-500 font-medium">
              {activeTab === "pending" && "No pending stock transfers."}
              {activeTab === "accepted" && "No accepted transfers yet."}
              {activeTab === "rejected" && "No rejected transfers."}
            </p>
          </div>
        ) : (
          displayedTransfers.map((transfer) => (
            <div key={transfer.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex flex-col hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 leading-tight">{transfer.stockItem.productName}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {transfer.stockItem.brand || "Unknown Brand"} • {transfer.stockItem.category || "Uncategorized"}
                  </p>
                </div>
                <div className="bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-lg text-center">
                  <span className="block text-2xl font-black text-gray-900 leading-none">{transfer.quantity}</span>
                  <span className="block text-[10px] font-semibold text-gray-500 uppercase mt-1 tracking-wider">QTY</span>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-md mb-5 text-sm border border-gray-100 flex-grow">
                <p className="text-gray-600 mb-1">
                  <span className="font-medium">Sent by:</span> {transfer.upazillaReseller.email}
                </p>
                <p className="text-gray-500 text-xs">
                  From {transfer.upazillaReseller.upazilla}
                </p>
                <p className="text-gray-400 text-xs mt-2 italic">
                  Received {formatTimeAgo(transfer.createdAt)}
                </p>
              </div>

              {activeTab === "pending" && (
                <div className="flex gap-3 mt-auto">
                  <button
                    onClick={() => handleAction(transfer.id, "accept")}
                    disabled={processingId !== null}
                    className="flex-1 bg-green-600 text-white font-medium py-2 rounded-md hover:bg-green-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                  >
                    {processingId === transfer.id ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : "Accept"}
                  </button>
                  <button
                    onClick={() => handleAction(transfer.id, "reject")}
                    disabled={processingId !== null}
                    className="flex-1 bg-white text-red-600 font-medium py-2 rounded-md border border-red-200 hover:bg-red-50 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                  >
                    Reject
                  </button>
                </div>
              )}

              {activeTab !== "pending" && (
                <div className={`mt-auto text-center py-2 rounded-md font-medium text-sm ${activeTab === 'accepted' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {activeTab === 'accepted' ? '✓ Accepted' : '✕ Rejected'}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
