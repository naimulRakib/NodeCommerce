"use client";

import { useState, useEffect } from "react";
import { Package, Clock, AlertCircle, CheckCircle, XCircle } from "lucide-react";

export function NegotiationPanel() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/upazilla-reseller/stock-orders");
      if (!res.ok) throw new Error("Failed to fetch stock orders");
      const data = await res.json();
      setOrders(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: "accept_counter" | "cancel", agreedPrice?: number) => {
    try {
      setProcessingId(id);
      const res = await fetch(`/api/upazilla-reseller/stock-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, agreedPrice }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Action failed");
      }

      await fetchOrders();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const tabs = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "countered", label: "Countered" },
    { id: "accepted", label: "Accepted" },
    { id: "fulfilled", label: "Fulfilled" },
    { id: "rejected", label: "Rejected" },
    { id: "cancelled", label: "Cancelled" },
  ];

  const filteredOrders = activeTab === "all" ? orders : orders.filter(o => o.status === activeTab);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>;
      case "countered": return <span className="bg-yellow-100 text-yellow-800 px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Countered</span>;
      case "accepted": return <span className="bg-green-100 text-green-800 px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Accepted</span>;
      case "fulfilled": return <span className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1"><Package className="w-3 h-3" /> Fulfilled</span>;
      case "rejected": return <span className="bg-red-100 text-red-800 px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</span>;
      case "cancelled": return <span className="bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1"><XCircle className="w-3 h-3" /> Cancelled</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Stock Order Negotiations</h2>
        
        {/* Tabs Scrollable */}
        <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
          <div className="flex space-x-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-gray-600 border hover:bg-gray-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-white border rounded-xl animate-pulse p-5">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
              <div className="h-6 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">No stock orders found in this status.</p>
          <p className="text-gray-400 text-sm mt-1">Go to Sellers tab to browse and order stock.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col">
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{order.productName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {order.productCode}
                      </span>
                      <span className="text-sm text-gray-500">from {order.seller.storeName}</span>
                    </div>
                  </div>
                  {getStatusBadge(order.status)}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div>
                    <p className="text-gray-500">Requested</p>
                    <p className="font-semibold text-gray-900">{order.requestedQuantity} units</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Original Price</p>
                    <p className="font-semibold line-through text-gray-400">BDT {order.originalPrice}</p>
                  </div>
                  <div className="col-span-2 border-t border-gray-200 pt-2 flex justify-between items-center">
                    <p className="text-gray-600 font-medium">Your Offer:</p>
                    <p className="font-bold text-blue-600 text-base">BDT {order.negotiatedPrice}/unit</p>
                  </div>
                </div>

                {order.status === "countered" && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-800 font-medium mb-1">
                      <AlertCircle className="w-4 h-4" />
                      Seller countered at BDT {order.counterPrice}/unit
                    </div>
                    {order.sellerNote && (
                      <p className="text-sm text-yellow-700 italic border-l-2 border-yellow-300 pl-2 mt-2">
                        "{order.sellerNote}"
                      </p>
                    )}
                    <div className="mt-3 text-sm text-yellow-800 font-medium">
                      New Total: BDT {(order.counterPrice * order.requestedQuantity).toFixed(2)}
                    </div>
                  </div>
                )}

                {order.status === "rejected" && order.sellerNote && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">
                      <span className="font-medium">Reason for rejection:</span> {order.sellerNote}
                    </p>
                  </div>
                )}

                {order.status === "accepted" && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">Seller accepted! Final price: BDT {order.finalPrice}/unit. Waiting for stock delivery.</p>
                  </div>
                )}

                {order.status === "fulfilled" && (
                  <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-2 text-gray-700">
                    <Package className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">Stock received! Check Available Stock & Inventory.</p>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              {(order.status === "pending" || order.status === "countered") && (
                <div className="p-4 bg-gray-50 border-t flex gap-3">
                  {order.status === "countered" && (
                    <button
                      onClick={() => handleAction(order.id, "accept_counter", order.counterPrice)}
                      disabled={processingId === order.id}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {processingId === order.id ? "Processing..." : "Accept Counter"}
                    </button>
                  )}
                  <button
                    onClick={() => handleAction(order.id, "cancel")}
                    disabled={processingId === order.id}
                    className={`flex-1 border border-red-200 text-red-600 hover:bg-red-50 font-medium py-2 rounded-lg transition-colors disabled:opacity-50 ${
                      order.status === "pending" ? "w-full" : ""
                    }`}
                  >
                    {processingId === order.id ? "Processing..." : (order.status === "countered" ? "Decline" : "Cancel Order")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
