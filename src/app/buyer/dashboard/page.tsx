"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabase";
import OrderStatusBadge from "@/components/buyer/OrderStatusBadge";
import bdLocations from "@/data/bangladesh-locations.json";

const STATUS_STEPS = ["pending", "confirmed", "processing", "shipped", "delivered"];

function OrderTimeline({ status }: { status: string }) {
  const currentIdx = STATUS_STEPS.indexOf(status);
  const isCancelled = status === "cancelled";

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
        <span className="text-sm text-red-600 font-medium">Order Cancelled</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0 mt-3 overflow-x-auto pb-1">
      {STATUS_STEPS.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0 ${
                  isDone
                    ? "bg-green-500 border-green-500"
                    : isCurrent
                    ? "bg-orange-500 border-orange-500 animate-pulse"
                    : "bg-white border-gray-300"
                }`}
              >
                {isDone ? (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className={`w-2 h-2 rounded-full ${isCurrent ? "bg-white" : "bg-gray-300"}`} />
                )}
              </div>
              <span className={`text-[10px] mt-1 capitalize whitespace-nowrap ${isCurrent ? "text-orange-600 font-bold" : isDone ? "text-green-600 font-medium" : "text-gray-400"}`}>
                {step}
              </span>
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <div className={`h-0.5 w-8 sm:w-12 flex-shrink-0 mx-0.5 mb-4 ${idx < currentIdx ? "bg-green-400" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

import { Suspense } from "react";

export default function BuyerDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BuyerDashboardContent />
    </Suspense>
  );
}

function BuyerDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "profile";
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Profile State
  const [profile, setProfile] = useState<any>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Orders State
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderFilter, setOrderFilter] = useState("All");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const { data } = await supabaseClient.auth.getUser();
        if (!data.user) {
          router.replace("/buyer/login");
          return;
        }
        if (isMounted) setUser(data.user);

        const res = await fetch("/api/buyer/profile");
        if (res.ok) {
          const profileData = await res.json();
          if (isMounted) setProfile(profileData.profile);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoadingAuth(false);
      }
    }
    init();
    return () => { isMounted = false; };
  }, [router]);

  useEffect(() => {
    if (activeTab === "orders" && !loadingAuth && user) {
      fetchOrders();
    }
  }, [activeTab, loadingAuth, user]);

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/buyer/order");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/buyer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert((err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    setCancellingId(orderId);
    try {
      const res = await fetch(`/api/buyer/order/${orderId}`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel order");
      fetchOrders();
    } catch (err: any) {
      alert((err instanceof Error ? err.message : String(err)));
    } finally {
      setCancellingId(null);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filteredOrders = orderFilter === "All"
    ? orders
    : orders.filter((o: any) => o.status === orderFilter.toLowerCase());

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 gap-8">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit flex-shrink-0">
        <div className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white text-center">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur text-white flex items-center justify-center text-2xl font-extrabold mx-auto mb-3 border-2 border-white/30">
            {profile?.fullName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
          </div>
          <h2 className="font-bold text-lg">{profile?.fullName || "Buyer"}</h2>
          <p className="text-sm text-orange-100 mt-0.5 truncate">{user?.email}</p>
        </div>
        <nav className="flex flex-row md:flex-col p-3 gap-1 overflow-x-auto">
          {[
            { id: "profile", label: "My Profile", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
            { id: "orders", label: "My Orders", icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg text-left flex-shrink-0 transition-colors ${
                activeTab === tab.id
                  ? "bg-orange-50 text-orange-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
              {tab.id === "orders" && orders.length > 0 && (
                <span className="ml-auto text-xs bg-orange-100 text-orange-600 font-bold px-2 py-0.5 rounded-full">
                  {orders.length}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => router.push("/buyer/search")}
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg text-left text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1116.65 2a7.5 7.5 0 010 14.65z" />
            </svg>
            Browse Products
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {activeTab === "profile" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 animate-fade-in">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Profile Settings</h2>
            <p className="text-sm text-gray-500 mb-6">Manage your personal information and delivery address.</p>
            <form onSubmit={handleProfileSave} className="space-y-6 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profile?.fullName || ""}
                    onChange={e => setProfile({ ...profile, fullName: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={profile?.phone || ""}
                    onChange={e => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Delivery Address</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                    <textarea
                      rows={2}
                      value={profile?.address || ""}
                      onChange={e => setProfile({ ...profile, address: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City / District</label>
                      <select
                        value={profile?.district || ""}
                        onChange={e => {
                          const dist = e.target.value;
                          setProfile({ ...profile, district: dist, city: dist, upazilla: "" });
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white"
                        required
                      >
                        <option value="">Select District</option>
                        {Object.keys(bdLocations).sort().map(dist => (
                          <option key={dist} value={dist}>{dist}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Upazilla</label>
                      <select
                        value={profile?.upazilla || ""}
                        onChange={e => setProfile({ ...profile, upazilla: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
                        required
                        disabled={!profile?.district}
                      >
                        <option value="">Select Upazilla</option>
                        {profile?.district && (bdLocations as any)[profile.district]?.sort().map((upz: string) => (
                          <option key={upz} value={upz}>{upz}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Local Area (Optional)</label>
                      <input
                        type="text"
                        value={profile?.city !== profile?.district ? profile?.city || "" : ""}
                        onChange={e => setProfile({ ...profile, city: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                        placeholder="E.g. Dhanmondi, Agrabad"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                {saveSuccess && (
                  <span className="text-sm text-green-600 font-medium animate-fade-in flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    Saved!
                  </span>
                )}
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-semibold text-sm hover:bg-orange-700 disabled:opacity-50 transition flex items-center gap-2"
                >
                  {savingProfile ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
                  ) : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === "orders" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">My Orders</h2>
              <button onClick={fetchOrders} className="text-xs text-orange-600 hover:text-orange-800 font-medium flex items-center gap-1 transition">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Refresh
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {["All", "Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"].map(status => (
                <button
                  key={status}
                  onClick={() => setOrderFilter(status)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                    orderFilter === status
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {loadingOrders ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
                    <div className="skeleton h-5 w-32" />
                    <div className="skeleton h-4 w-full" />
                    <div className="skeleton h-4 w-2/3" />
                  </div>
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                <p className="text-gray-500 font-medium mb-4">No orders found.</p>
                <button onClick={() => router.push("/buyer/search")} className="px-6 py-2 bg-orange-100 text-orange-700 rounded-lg font-medium hover:bg-orange-200 transition">
                  Start Shopping
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order: any) => (
                  <div key={order.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start flex-wrap gap-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="font-mono text-sm font-bold text-gray-900">#{order.id.slice(-8).toUpperCase()}</h3>
                          <OrderStatusBadge status={order.status} />
                        </div>
                        <p className="text-xs text-gray-400">
                          Placed on {new Date(order.createdAt).toLocaleDateString("en-BD", { year: "numeric", month: "short", day: "numeric" })}
                          {" · "}<span className="font-medium text-gray-600">{order.seller?.storeName}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Total</p>
                        <p className="font-bold text-lg text-orange-600">৳{order.totalAmount.toLocaleString("en-BD")}</p>
                      </div>
                    </div>

                    {/* Delivery Details */}
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Delivery Address</p>
                      <p className="text-sm text-gray-700">{order.deliveryAddress}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{order.city}, {order.upazilla}, {order.district}</p>
                      {order.buyerNote && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-0.5">Note to Seller</p>
                          <p className="text-sm text-gray-700">{order.buyerNote}</p>
                        </div>
                      )}
                    </div>

                    {/* Order Timeline */}
                    <OrderTimeline status={order.status} />

                    {/* Items */}
                    <div className="space-y-3 border-t border-gray-100 pt-4">
                      {order.items.map((item: any) => (
                        <div key={item.id} className="flex gap-3">
                          <div className="w-14 h-14 bg-gray-100 rounded-lg border border-gray-100 overflow-hidden flex-shrink-0">
                            {item.sellerProduct?.globalProduct?.imageUrl ? (
                              <img src={item.sellerProduct.globalProduct.imageUrl} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 line-clamp-1">
                              {item.sellerProduct?.customName || item.sellerProduct?.globalProduct?.name}
                            </p>
                            <p className="text-sm text-gray-500 mt-0.5">{item.quantity} × ৳{item.priceAtPurchase.toLocaleString("en-BD")}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {["pending", "confirmed"].includes(order.status) && (
                      <div className="pt-3 border-t border-gray-100 flex justify-end">
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          disabled={cancellingId === order.id}
                          className="px-4 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 font-medium transition disabled:opacity-50 flex items-center gap-2"
                        >
                          {cancellingId === order.id ? (
                            <><div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />Cancelling...</>
                          ) : "Cancel Order"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
