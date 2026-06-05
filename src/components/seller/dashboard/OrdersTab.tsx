"use client";

import { useState, useEffect, useCallback } from "react";
import OrderStatusBadge from "@/components/buyer/OrderStatusBadge";

function CancelModal({ orderId, onConfirm, onClose }: { orderId: string; onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-bounce-in">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Cancel Order</h3>
        <p className="text-sm text-gray-500 mb-4">Please provide a reason for cancellation. This will be shared with the buyer.</p>
        <textarea
          rows={3}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Out of stock, unable to fulfil..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
          autoFocus
        />
        <div className="flex gap-3 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium transition">
            Go Back
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition disabled:opacity-40"
          >
            Confirm Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async (isMounted: boolean = true) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/seller/orders?status=${filter}`);
      if (res.ok) {
        const data = await res.json();
        if (isMounted) setOrders(data.orders || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (isMounted) setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    let isMounted = true;
    fetchOrders(isMounted);
    // Auto-refresh every 60s for new orders
    const interval = setInterval(() => {
      fetchOrders(isMounted);
    }, 60000);
    return () => { 
      isMounted = false;
      clearInterval(interval); 
    };
  }, [fetchOrders]);

  const handleStatusUpdate = async (orderId: string, newStatus: string, note?: string) => {
    setProcessingId(orderId);
    try {
      // Optimistic update
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

      const res = await fetch(`/api/seller/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update order");
      
      // Sync with absolute backend truth
      if (data.order) {
        setOrders(prev => prev.map(o => o.id === orderId ? data.order : o));
      }
    } catch (err: any) {
      alert(err.message);
      fetchOrders(); // Revert
    } finally {
      setProcessingId(null);
      setCancelTarget(null);
    }
  };

  const ACTION_MAP: Record<string, { label: string; nextStatus: string; color: string }> = {
    pending: { label: "Confirm Order", nextStatus: "confirmed", color: "bg-green-600 hover:bg-green-700 text-white" },
    confirmed: { label: "Mark Processing", nextStatus: "processing", color: "bg-blue-600 hover:bg-blue-700 text-white" },
    processing: { label: "Mark Shipped", nextStatus: "shipped", color: "bg-indigo-600 hover:bg-indigo-700 text-white" },
    shipped: { label: "Mark Delivered", nextStatus: "delivered", color: "bg-green-600 hover:bg-green-700 text-white" },
  };

  const StatusFilters = ["All", "Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];

  return (
    <div className="space-y-6">
      {cancelTarget && (
        <CancelModal
          orderId={cancelTarget}
          onConfirm={(reason) => handleStatusUpdate(cancelTarget, "cancelled", reason)}
          onClose={() => setCancelTarget(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mt-0.5">
            {orders.length} order{orders.length !== 1 ? "s" : ""} — auto-refreshes every minute
          </p>
        </div>
        <button
          onClick={() => fetchOrders()}
          className="text-sm text-orange-600 hover:text-orange-800 font-medium flex items-center gap-1.5 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {StatusFilters.map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
              filter === status
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
              <div className="skeleton h-5 w-48" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-16 w-full" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          <p className="text-gray-500 font-medium">No orders found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const action = ACTION_MAP[order.status];
            const isProcessing = processingId === order.id;
            return (
              <div key={order.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Order Header */}
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-gray-900">#{order.id.slice(-8).toUpperCase()}</span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <span className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleString("en-BD", { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>

                <div className="p-5 flex flex-col md:flex-row gap-6">
                  {/* Order Info */}
                  <div className="flex-1 space-y-4">
                    {/* Customer & Address */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Customer</p>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {order.buyer?.fullName?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{order.buyer?.fullName}</p>
                            <p className="text-xs text-gray-500">{order.buyer?.phone || "No phone"}</p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Delivery</p>
                        <p className="text-sm text-gray-700">{order.deliveryAddress}</p>
                        <p className="text-xs text-gray-500">{order.city}, {order.upazilla}, {order.district}</p>
                      </div>
                    </div>

                    {/* Items */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Items</p>
                      <ul className="space-y-2">
                        {order.items.map((item: any) => (
                          <li key={item.id} className="text-sm flex justify-between items-center gap-4">
                            <span className="text-gray-700 line-clamp-1">
                              {item.quantity} × {item.sellerProduct?.customName || item.sellerProduct?.globalProduct?.name}
                            </span>
                            <span className="font-semibold text-gray-900 flex-shrink-0">৳{item.priceAtPurchase.toLocaleString("en-BD")}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between font-bold text-gray-900">
                        <span>Total</span>
                        <span className="text-orange-600">৳{order.totalAmount.toLocaleString("en-BD")}</span>
                      </div>
                    </div>

                    {order.buyerNote && (
                      <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm border border-amber-100 flex gap-2">
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        <span><strong>Buyer Note: </strong>{order.buyerNote}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="w-full md:w-44 flex flex-col gap-2.5 pt-4 md:pt-0 md:border-l md:border-gray-100 md:pl-6 justify-center">
                    {action && (
                      <button
                        onClick={() => handleStatusUpdate(order.id, action.nextStatus)}
                        disabled={isProcessing}
                        className={`w-full py-2.5 px-3 rounded-lg text-sm font-semibold transition ${action.color} disabled:opacity-50 flex items-center justify-center gap-2`}
                      >
                        {isProcessing ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : action.label}
                      </button>
                    )}

                    {["pending", "confirmed"].includes(order.status) && (
                      <button
                        onClick={() => setCancelTarget(order.id)}
                        className="w-full py-2.5 px-3 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 transition"
                      >
                        Cancel Order
                      </button>
                    )}

                    {["delivered", "cancelled"].includes(order.status) && (
                      <p className="text-xs text-gray-400 text-center italic">Order complete</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
