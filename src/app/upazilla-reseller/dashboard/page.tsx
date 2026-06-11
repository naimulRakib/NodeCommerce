"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabase";
import InventorySection from "@/components/upazilla-reseller/InventorySection";
import LocalResellerMonitor from "@/components/upazilla-reseller/LocalResellerMonitor";
import TransferHistoryTable from "@/components/upazilla-reseller/TransferHistoryTable";
import IncomingDistrictStockPanel from "@/components/upazilla-reseller/IncomingDistrictStockPanel";
import DemandPanel from "@/components/upazilla-reseller/DemandPanel";
import { SellersPanel } from "@/components/upazilla-reseller/SellersPanel";
import { NegotiationPanel } from "@/components/upazilla-reseller/NegotiationPanel";
import { AvailableStockPanel } from "@/components/upazilla-reseller/AvailableStockPanel";
import { AcoShipmentsPanel } from "@/components/upazilla-reseller/AcoShipmentsPanel";
import UpazillaUiPathPanel from "@/components/upazilla-reseller/UpazillaUiPathPanel";
import UpazillaGrokPanel from "@/components/upazilla-reseller/UpazillaGrokPanel";
import { BarChart2, Store, MessageSquare, PackageSearch } from "lucide-react";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const initialTab = searchParams.get("tab") || "inventory";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [profile, setProfile] = useState<{ email: string; city: string; upazilla: string; createdAt: string } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasPendingTransfers, setHasPendingTransfers] = useState(false);
  const [hasPendingDistrictTransfers, setHasPendingDistrictTransfers] = useState(false);
  const [pendingDemandCount, setPendingDemandCount] = useState(0);
  const [sellerCount, setSellerCount] = useState(0);
  const [needsAttentionCount, setNeedsAttentionCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    if (typeof window !== "undefined") {
      setIsOffline(!window.navigator.onLine);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      try {
        const { data } = await supabaseClient.auth.getUser();
        if (!data.user) {
          router.replace("/upazilla-reseller/login");
          return;
        }

        const res = await fetch("/api/upazilla-reseller/profile");
        if (res.status === 404 || res.status === 401) {
          router.replace("/upazilla-reseller/login");
          return;
        }

        if (res.ok) {
          const profileData = await res.json();
          setProfile(profileData);
          setUserId(data.user.id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoadingAuth(false);
      }
    }
    checkAuth();

    return () => { isMounted = false; };
  }, [router]);

  // Tab sync
  useEffect(() => {
    if (typeof window !== "undefined" && activeTab !== searchParams.get("tab")) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("tab", activeTab);
      window.history.replaceState(null, "", newUrl.toString());
    }
  }, [activeTab, searchParams]);

  // Clear demand badge when opened
  useEffect(() => {
    if (activeTab === "demand") {
      setPendingDemandCount(0);
    }
  }, [activeTab]);

  // Poll for pending transfers
  useEffect(() => {
    let isMounted = true;
    const fetchPendingTransfers = async () => {
      try {
        const res = await fetch("/api/upazilla-reseller/transfer");
        if (res.ok) {
          const transfers = await res.json();
          const hasPending = transfers.some((t: any) => t.status === "pending");
          if (isMounted) setHasPendingTransfers(hasPending);
        }
      } catch (e) { }

      try {
        const resDist = await fetch("/api/upazilla-reseller/district-transfers");
        if (resDist.ok) {
          const transfersDist = await resDist.json();
          const hasPendingDist = transfersDist.some((t: any) => t.status === "pending");
          if (isMounted) setHasPendingDistrictTransfers(hasPendingDist);
        }
      } catch (e) { }

      // Poll demand count
      try {
        const { data } = await supabaseClient.auth.getUser();
        if (data?.user?.id) {
          const resDemand = await fetch(`/api/demand/upazilla?upazillaResellerId=${data.user.id}`);
          if (resDemand.ok) {
            const demands = await resDemand.json();
            const pendingCount = demands.filter((d: any) => d.status !== "fulfilled").length;
            if (isMounted) setPendingDemandCount(pendingCount);
          }
        }
      } catch (e) { }

      // Poll sellers and negotiations counts
      try {
        const resSellers = await fetch("/api/upazilla-reseller/sellers");
        if (resSellers.ok) {
          const sellersData = await resSellers.json();
          if (isMounted) setSellerCount(sellersData.length);
        }

        const resOrders = await fetch("/api/upazilla-reseller/stock-orders");
        if (resOrders.ok) {
          const ordersData = await resOrders.json();
          const count = ordersData.filter((o: any) => o.status === "countered").length;
          if (isMounted) setNeedsAttentionCount(count);
        }
      } catch (e) { }
    };
    
    fetchPendingTransfers(); // initial
    const interval = setInterval(fetchPendingTransfers, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    router.push("/upazilla-reseller/login");
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-gray-900 text-white min-h-screen fixed left-0 top-0 z-30 overflow-y-auto">
        <div className="p-6 border-b border-gray-800 flex-shrink-0">
          <Link href="/" className="text-xl font-bold text-orange-500 mb-4 block">
            NodeCommerce
          </Link>
          <div className="bg-gray-800 px-3 py-2 rounded-md">
            <span className="block text-xs font-semibold text-orange-400 uppercase tracking-wider mb-1">Upazilla Reseller</span>
            <span className="block text-sm font-medium text-white truncate">{profile?.email || "Loading..."}</span>
            <span className="block text-xs text-gray-400 truncate mt-0.5">{profile ? `${profile.city}, ${profile.upazilla}` : "Loading..."}</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
          <button onClick={() => setActiveTab("inventory")} className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition ${activeTab === 'inventory' ? 'bg-orange-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            <span className="truncate">Inventory</span>
          </button>
          
          <button onClick={() => setActiveTab("sellers")} className={`relative flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition ${activeTab === 'sellers' ? 'bg-orange-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <Store className="w-5 h-5 flex-shrink-0" />
            <span className="truncate">Sellers</span>
            {sellerCount > 0 && (
              <span className="absolute top-3 right-3 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                {sellerCount}
              </span>
            )}
          </button>

          <button onClick={() => setActiveTab("demand")} className={`relative flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition ${activeTab === 'demand' ? 'bg-orange-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <BarChart2 className="w-5 h-5 flex-shrink-0" />
            <span className="truncate">Demand</span>
            {pendingDemandCount > 0 && (
              <span className="absolute top-3 right-3 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {pendingDemandCount}
              </span>
            )}
          </button>

          <button onClick={() => setActiveTab("resellers")} className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition ${activeTab === 'resellers' ? 'bg-orange-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            <span className="truncate">Local Resellers</span>
          </button>
          
          <button onClick={() => setActiveTab("transfers")} className={`relative flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition ${activeTab === 'transfers' ? 'bg-orange-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            <span className="truncate">Transfer History</span>
            {hasPendingTransfers && (
              <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0"></span>
            )}
          </button>

          <button onClick={() => setActiveTab("from-district")} className={`relative flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition ${activeTab === 'from-district' ? 'bg-orange-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7m14-6l-7 7-7-7" />
            </svg>
            <span className="truncate">From District</span>
            {hasPendingDistrictTransfers && (
              <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0"></span>
            )}
          </button>

          <button onClick={() => setActiveTab("negotiations")} className={`relative flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition ${activeTab === 'negotiations' ? 'bg-orange-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <MessageSquare className="w-5 h-5 flex-shrink-0" />
            <span className="truncate">Negotiations</span>
            {needsAttentionCount > 0 && (
              <span className="absolute top-3 right-3 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {needsAttentionCount}
              </span>
            )}
          </button>

          <button onClick={() => setActiveTab("available-stock")} className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition ${activeTab === 'available-stock' ? 'bg-orange-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <PackageSearch className="w-5 h-5 flex-shrink-0" />
            <span className="truncate">Available Stock</span>
          </button>

          <button onClick={() => setActiveTab("aco-shipments")} className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition ${activeTab === 'aco-shipments' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <span className="text-xl leading-none w-5 flex-shrink-0 text-center">🐜</span>
            <span className="truncate">ACO Pipeline</span>
          </button>

          <button onClick={() => setActiveTab("profile")} className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition ${activeTab === 'profile' ? 'bg-orange-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <span className="truncate">Profile</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 flex flex-col w-full">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 flex-shrink-0">
          <div className="px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Upazilla Reseller Dashboard</h1>
            <button
              onClick={handleLogout}
              className="px-3 sm:px-4 py-2 border border-gray-300 shadow-sm text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition whitespace-nowrap ml-2"
            >
              Sign out
            </button>
          </div>
        </header>

        {isOffline && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-center text-sm text-red-600 font-medium z-20 relative">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            You appear to be offline. Please check your internet connection.
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8 w-full overflow-x-hidden">
          {activeTab === "inventory" && (
            <div className="space-y-6">
              <InventorySection />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <UpazillaUiPathPanel />
                <UpazillaGrokPanel />
              </div>
            </div>
          )}
          {activeTab === "sellers" && profile && <SellersPanel upazillaName={profile.upazilla} />}
          {activeTab === "resellers" && <LocalResellerMonitor />}
          {activeTab === "from-district" && <IncomingDistrictStockPanel />}
          {activeTab === "transfers" && <TransferHistoryTable />}
          {activeTab === "demand" && userId && <DemandPanel upazillaResellerId={userId} />}
          {activeTab === "negotiations" && <NegotiationPanel />}
          {activeTab === "available-stock" && <AvailableStockPanel />}
          {activeTab === "aco-shipments" && <AcoShipmentsPanel />}
          {activeTab === "profile" && (
            <div className="max-w-2xl bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">Reseller Profile</h3>
                <p className="text-sm text-gray-500">Read-only account information</p>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Email</label>
                  <p className="text-gray-900 font-medium break-all">{profile?.email}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">City / District</label>
                    <p className="text-gray-900 font-medium">{profile?.city}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Upazilla</label>
                    <p className="text-gray-900 font-medium">{profile?.upazilla}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Member Since</label>
                  <p className="text-gray-900 font-medium">{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : ""}</p>
                </div>
                <div className="mt-8 bg-blue-50 border-l-4 border-blue-400 p-4">
                  <div className="flex gap-2">
                    <div className="flex-shrink-0">ℹ️</div>
                    <div className="min-w-0">
                      <p className="text-sm text-blue-700">
                        To change your city or upazilla, log out and log in again. You will be prompted to select your location on login.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-20">
          <button onClick={() => setActiveTab("inventory")} className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider ${activeTab === 'inventory' ? 'text-orange-600 border-t-2 border-orange-600' : 'text-gray-500 hover:text-gray-900 border-t-2 border-transparent'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            <span className="line-clamp-1">Inventory</span>
          </button>
          <button onClick={() => setActiveTab("resellers")} className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider ${activeTab === 'resellers' ? 'text-orange-600 border-t-2 border-orange-600' : 'text-gray-500 hover:text-gray-900 border-t-2 border-transparent'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            <span className="line-clamp-1">Resellers</span>
          </button>
          <button onClick={() => setActiveTab("from-district")} className={`relative flex-1 py-3 px-2 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider ${activeTab === 'from-district' ? 'text-orange-600 border-t-2 border-orange-600' : 'text-gray-500 hover:text-gray-900 border-t-2 border-transparent'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7m14-6l-7 7-7-7" />
            </svg>
            <span className="line-clamp-1">From District</span>
            {hasPendingDistrictTransfers && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </button>
          <button onClick={() => setActiveTab("transfers")} className={`relative flex-1 py-3 px-2 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider ${activeTab === 'transfers' ? 'text-orange-600 border-t-2 border-orange-600' : 'text-gray-500 hover:text-gray-900 border-t-2 border-transparent'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            <span className="line-clamp-1">Transfers</span>
            {hasPendingTransfers && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </button>
          <button onClick={() => setActiveTab("demand")} className={`relative flex-1 py-3 px-2 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider ${activeTab === 'demand' ? 'text-orange-600 border-t-2 border-orange-600' : 'text-gray-500 hover:text-gray-900 border-t-2 border-transparent'}`}>
            <BarChart2 className="w-6 h-6" />
            <span className="line-clamp-1">Demand</span>
            {pendingDemandCount > 0 && (
              <span className="absolute top-2 right-2 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                {pendingDemandCount}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab("aco-shipments")} className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider ${activeTab === 'aco-shipments' ? 'text-purple-600 border-t-2 border-purple-600' : 'text-gray-500 hover:text-gray-900 border-t-2 border-transparent'}`}>
            <span className="text-xl leading-none h-6">🐜</span>
            <span className="line-clamp-1">ACO</span>
          </button>
          <button onClick={() => setActiveTab("profile")} className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider ${activeTab === 'profile' ? 'text-orange-600 border-t-2 border-orange-600' : 'text-gray-500 hover:text-gray-900 border-t-2 border-transparent'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <span className="line-clamp-1">Profile</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

export default function UpazillaResellerDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
