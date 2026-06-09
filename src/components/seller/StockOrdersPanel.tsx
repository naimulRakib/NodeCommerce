"use client";

import { useState, useEffect } from "react";
import { Package, Clock, CheckCircle, XCircle, AlertCircle, TrendingDown, Check } from "lucide-react";

export function StockOrdersPanel() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionForm, setActionForm] = useState<{ id: string; type: "counter" | "reject" } | null>(null);
  const [counterPrice, setCounterPrice] = useState<number>(0);
  const [sellerNote, setSellerNote] = useState<string>("");
  const [fulfillResult, setFulfillResult] = useState<{ id: string; result: any } | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/seller/stock-orders");
      if (!res.ok) throw new Error("Failed to fetch incoming stock orders");
      const data = await res.json();
      setOrders(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: string, data?: any) => {
    try {
      setProcessingId(id);
      const res = await fetch(`/api/seller/stock-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...data }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Action failed");
      }

      setActionForm(null);
      await fetchOrders();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleFulfill = async (id: string) => {
    try {
      setProcessingId(id);
      setFulfillResult(null);
      const res = await fetch(`/api/seller/stock-orders/${id}/fulfill`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Fulfillment failed");
      }

      setFulfillResult({ id, result: data });
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
  ];

  const filteredOrders = activeTab === "all" ? orders : orders.filter(o => o.status === activeTab);

  const openActionForm = (id: string, type: "counter" | "reject", currentOrder: any) => {
    setActionForm({ id, type });
    setCounterPrice(currentOrder.negotiatedPrice);
    setSellerNote("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Incoming Stock Orders</h2>
        
        <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
          <div className="flex space-x-2">
            {tabs.map((tab) => {
              const count = tab.id === "all" ? orders.length : orders.filter(o => o.status === tab.id).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-gray-600 border hover:bg-gray-50"
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                      activeTab === tab.id ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
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
          <p className="text-gray-500 text-lg">No incoming stock orders found.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredOrders.map((order) => {
            const diff = order.originalPrice - order.negotiatedPrice;
            const isFullPrice = diff <= 0;

            return (
              <div key={order.id} className="bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{order.productName}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                          {order.productCode}
                        </span>
                        <span className="text-sm text-gray-500">Req: <span className="font-medium text-gray-900">{order.requestedQuantity} units</span></span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                        order.status === "pending" ? "bg-blue-100 text-blue-800" :
                        order.status === "countered" ? "bg-yellow-100 text-yellow-800" :
                        order.status === "accepted" ? "bg-green-100 text-green-800" :
                        order.status === "fulfilled" ? "bg-gray-100 text-gray-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded flex items-center gap-2 border border-gray-100">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xs font-bold">
                      {order.upazillaReseller.upazilla.charAt(0)}
                    </div>
                    <span>From: <strong>{order.upazillaReseller.email}</strong> ({order.upazillaReseller.upazilla})</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-gray-500 mb-1">Your List Price</p>
                      <p className="font-medium">BDT {order.originalPrice}</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-blue-800 mb-1">Their Offer</p>
                      <p className="font-bold text-blue-700 text-base">BDT {order.negotiatedPrice}</p>
                    </div>
                  </div>

                  <div className="flex justify-end mb-4">
                    {isFullPrice ? (
                      <span className="flex items-center gap-1 text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                        <Check className="w-4 h-4" /> Full price offer
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
                        <TrendingDown className="w-4 h-4" /> ↓ BDT {diff.toFixed(2)} less
                      </span>
                    )}
                  </div>

                  {order.upazillaNote && (
                    <div className="p-3 bg-gray-50 text-gray-600 text-sm rounded-lg border border-gray-200 mb-4 italic">
                      " {order.upazillaNote} "
                    </div>
                  )}

                  {/* Fulfillment Result Banner */}
                  {fulfillResult?.id === order.id && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 space-y-1">
                      <p className="font-bold flex items-center gap-1 mb-2"><CheckCircle className="w-5 h-5" /> Successfully fulfilled!</p>
                      <p>✓ Stock deducted: {order.requestedQuantity} units</p>
                      <p>✓ Demand fulfilled: {fulfillResult.result.demandFulfilled} units</p>
                      <p>✓ Available stock created: {fulfillResult.result.availableStock} units</p>
                    </div>
                  )}

                </div>

                {/* Actions Footer */}
                {order.status === "pending" && actionForm?.id !== order.id && (
                  <div className="p-4 bg-gray-50 border-t flex gap-2">
                    <button
                      onClick={() => handleAction(order.id, "accept")}
                      disabled={processingId === order.id}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <CheckCircle className="w-4 h-4" /> Accept
                    </button>
                    <button
                      onClick={() => openActionForm(order.id, "counter", order)}
                      disabled={processingId === order.id}
                      className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <AlertCircle className="w-4 h-4" /> Counter
                    </button>
                    <button
                      onClick={() => openActionForm(order.id, "reject", order)}
                      disabled={processingId === order.id}
                      className="flex-1 border border-red-200 text-red-600 hover:bg-red-50 font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )}

                {/* Inline Action Forms */}
                {actionForm?.id === order.id && actionForm.type === "counter" && (
                  <div className="p-4 bg-yellow-50 border-t border-yellow-200 space-y-3">
                    <h4 className="font-medium text-yellow-900">Send Counter Offer</h4>
                    <div>
                      <label className="text-xs font-medium text-yellow-800">Counter Price (BDT)</label>
                      <input 
                        type="number" 
                        value={counterPrice} 
                        onChange={e => setCounterPrice(parseFloat(e.target.value) || 0)}
                        className="w-full mt-1 px-3 py-2 border rounded border-yellow-300 focus:ring-yellow-500 focus:border-yellow-500" 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-yellow-800">Note (Optional)</label>
                      <input 
                        type="text" 
                        value={sellerNote} 
                        onChange={e => setSellerNote(e.target.value)}
                        placeholder="e.g., Best I can do is..."
                        className="w-full mt-1 px-3 py-2 border rounded border-yellow-300 focus:ring-yellow-500 focus:border-yellow-500" 
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setActionForm(null)} className="flex-1 py-1.5 border border-yellow-400 text-yellow-800 rounded bg-yellow-100 hover:bg-yellow-200 font-medium text-sm">Cancel</button>
                      <button 
                        onClick={() => handleAction(order.id, "counter", { counterPrice, sellerNote })}
                        className="flex-1 py-1.5 bg-yellow-600 text-white rounded hover:bg-yellow-700 font-medium text-sm"
                      >
                        Send Counter
                      </button>
                    </div>
                  </div>
                )}

                {actionForm?.id === order.id && actionForm.type === "reject" && (
                  <div className="p-4 bg-red-50 border-t border-red-200 space-y-3">
                    <h4 className="font-medium text-red-900">Reject Order</h4>
                    <div>
                      <label className="text-xs font-medium text-red-800">Reason (Required)</label>
                      <input 
                        type="text" 
                        value={sellerNote} 
                        onChange={e => setSellerNote(e.target.value)}
                        placeholder="e.g., Stock unavailable"
                        className="w-full mt-1 px-3 py-2 border rounded border-red-300 focus:ring-red-500 focus:border-red-500" 
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setActionForm(null)} className="flex-1 py-1.5 border border-red-300 text-red-800 rounded bg-red-100 hover:bg-red-200 font-medium text-sm">Cancel</button>
                      <button 
                        onClick={() => handleAction(order.id, "reject", { sellerNote })}
                        className="flex-1 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 font-medium text-sm"
                      >
                        Confirm Reject
                      </button>
                    </div>
                  </div>
                )}

                {/* Fulfillment Button for Accepted Orders */}
                {order.status === "accepted" && (
                  <div className="p-4 bg-gray-50 border-t">
                    <button
                      onClick={() => handleFulfill(order.id)}
                      disabled={processingId === order.id}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {processingId === order.id ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Processing...
                        </div>
                      ) : (
                        <>Mark as Fulfilled →</>
                      )}
                    </button>
                    <p className="text-xs text-center text-gray-500 mt-2">
                      Click this when stock is handed over to the reseller. This will deduct your stock.
                    </p>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
