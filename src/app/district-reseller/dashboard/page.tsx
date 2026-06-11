"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabase";
import InventorySection from "@/components/district-reseller/InventorySection";
import UpazillaMonitor from "@/components/district-reseller/UpazillaMonitor";
import TransferHistoryTable from "@/components/district-reseller/TransferHistoryTable";
import DemandPanel from "@/components/district-reseller/DemandPanel";
import DistrictStockOverview from "@/components/district-reseller/DistrictStockOverview";
import NationalSurplusView from "@/components/district-reseller/NationalSurplusView";
import ACOPanel from "@/components/district-reseller/ACOPanel";
import DistrictUiPathPanel from "@/components/district-reseller/DistrictUiPathPanel";
import DistrictGrokPanel from "@/components/district-reseller/DistrictGrokPanel";
import { BarChart2, Package, Globe } from "lucide-react";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = searchParams.get("tab") || "inventory";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [profile, setProfile] = useState<{ email: string; district: string; createdAt: string } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Transfer history dot notification polling
  const prevTransfersRef = useRef<any[]>([]);
  const [showHistoryDot, setShowHistoryDot] = useState(false);
  const [pendingDemandCount, setPendingDemandCount] = useState(0);
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
          router.replace("/district-reseller/login");
          return;
        }

        const res = await fetch("/api/district-reseller/inventory");
        if (res.status === 404 || res.status === 401) {
          router.replace("/district-reseller/login");
          return;
        }

        if (res.ok) {
          // Profile exists, retrieve metadata
          const resellerRes = await fetch("/api/district-reseller/upazilla-resellers");
          if (resellerRes.ok) {
            const dataRes = await resellerRes.json();
            if (isMounted) {
              setProfile({
                email: data.user.email!,
                district: dataRes.district,
                createdAt: data.user.created_at
              });
              setUserId(data.user.id);
            }
          }
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

  // Tab state sync via native history API to avoid Next.js Suspense flickering
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlTab = activeTab === "upazilla" ? "upazillas" : activeTab;
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.get("tab") !== urlTab) {
      currentUrl.searchParams.set("tab", urlTab);
      window.history.replaceState(null, "", currentUrl.toString());
    }
  }, [activeTab]);

  // Handle browser back/forward buttons seamlessly
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      const currentUrl = new URL(window.location.href);
      const tabParam = currentUrl.searchParams.get("tab") || "inventory";
      const mapped = tabParam === "upazillas" ? "upazilla" : tabParam;
      setActiveTab(mapped);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Clear dot notification when history tab is opened
  useEffect(() => {
    if (activeTab === "transfers") {
      setShowHistoryDot(false);
    }
    if (activeTab === "demand") {
      setPendingDemandCount(0);
    }
  }, [activeTab]);

  // Poll transfers every 60s
  useEffect(() => {
    let isMounted = true;

    const checkTransfers = async () => {
      try {
        const res = await fetch("/api/district-reseller/transfer");
        if (res.ok) {
          const current = await res.json();
          if (isMounted && prevTransfersRef.current.length > 0) {
            const currentMap = new Map(current.map((c: any) => [c.id, c]));
            const changed = prevTransfersRef.current.some((prev: any) => {
              if (prev.status === "pending") {
                const curr: any = currentMap.get(prev.id);
                return curr && curr.status !== "pending";
              }
              return false;
            });
            if (changed) {
              setShowHistoryDot(true);
            }
          }
          if (isMounted) {
            prevTransfersRef.current = current;
          }
        }
      } catch (e) {
        console.error("Transfers polling error:", e);
      }
      
      try {
        const { data } = await supabaseClient.auth.getUser();
        if (data?.user?.id) {
          const resDemand = await fetch(`/api/demand/district?districtResellerId=${data.user.id}`);
          if (resDemand.ok) {
            const { districtDemands } = await resDemand.json();
            if (districtDemands) {
              const pendingCount = districtDemands.filter((d: any) => d.remainingDemand > 0).length;
              if (isMounted) setPendingDemandCount(pendingCount);
            }
          }
        }
      } catch (e) {
        console.error("Demand polling error:", e);
      }
    };

    checkTransfers(); // Initial poll
    const interval = setInterval(checkTransfers, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    router.push("/district-reseller/login");
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(249,115,22,0.5)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 flex flex-col md:flex-row text-slate-800">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white/80 backdrop-blur-xl border-r border-white/60 shadow-[4px_0_24px_rgba(0,0,0,0.03)] min-h-screen fixed left-0 top-0 z-30 overflow-y-auto">
        <div className="p-6 border-b border-gray-200/50 flex-shrink-0">
          <Link href="/" className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500 mb-5 block tracking-tight">
            NodeCommerce
          </Link>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/60 px-4 py-3 rounded-xl shadow-inner">
            <span className="block text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-1.5">District Reseller</span>
            <span className="block text-sm font-bold text-gray-900 truncate">{profile?.email || "Loading..."}</span>
            <span className="block text-xs text-gray-500 font-medium truncate mt-0.5">{profile?.district ? `${profile.district} District` : "Loading..."}</span>
          </div>
        </div>

        <nav className="flex-1 p-5 flex flex-col gap-2 overflow-y-auto">
          <button
            onClick={() => setActiveTab("inventory")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
              activeTab === "inventory"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 translate-x-1"
                : "text-gray-600 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1"
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span className="truncate">Inventory</span>
          </button>

          <button
            onClick={() => setActiveTab("upazilla")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
              activeTab === "upazilla"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 translate-x-1"
                : "text-gray-600 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1"
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="truncate">Upazilla Resellers</span>
          </button>

          <button
            onClick={() => setActiveTab("transfers")}
            className={`relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
              activeTab === "transfers"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 translate-x-1"
                : "text-gray-600 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1"
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span className="truncate">Transfer History</span>
            {showHistoryDot && (
              <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse flex-shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("demand")}
            className={`relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
              activeTab === "demand"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 translate-x-1"
                : "text-gray-600 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1"
            }`}
          >
            <BarChart2 className="w-5 h-5 flex-shrink-0" />
            <span className="truncate">Demand</span>
            {pendingDemandCount > 0 && (
              <span className="absolute top-3 right-3 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                {pendingDemandCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("stock-overview")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
              activeTab === "stock-overview"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 translate-x-1"
                : "text-gray-600 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1"
            }`}
          >
            <Package className="w-5 h-5 flex-shrink-0" />
            <span className="truncate">Stock Overview</span>
          </button>

          <button
            onClick={() => setActiveTab("aco")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
              activeTab === "aco"
                ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/25 translate-x-1"
                : "text-gray-600 hover:bg-purple-50 hover:text-purple-600 hover:translate-x-1"
            }`}
          >
            <span className="text-xl leading-none">🐜</span>
            <span className="truncate">ACO Pipeline</span>
          </button>

          <button
            onClick={() => setActiveTab("national-surplus")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
              activeTab === "national-surplus"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 translate-x-1"
                : "text-gray-600 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1"
            }`}
          >
            <Globe className="w-5 h-5 flex-shrink-0" />
            <span className="truncate">National Surplus</span>
          </button>

          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
              activeTab === "profile"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 translate-x-1"
                : "text-gray-600 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1"
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="truncate">Profile</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 flex flex-col w-full relative z-10">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-20 flex-shrink-0 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center">
            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-800 tracking-tight truncate">
              {profile?.district ? `${profile.district} District Dashboard` : "District Reseller Dashboard"}
            </h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-gray-200 shadow-sm text-xs sm:text-sm font-bold rounded-lg text-slate-600 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-300 whitespace-nowrap ml-2"
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
                <DistrictUiPathPanel />
                <DistrictGrokPanel />
              </div>
            </div>
          )}
          {activeTab === "upazilla" && <UpazillaMonitor />}
          {activeTab === "transfers" && <TransferHistoryTable />}
          {activeTab === "demand" && userId && <DemandPanel districtResellerId={userId} />}
          {activeTab === "stock-overview" && userId && <DistrictStockOverview districtResellerId={userId} />}
          {activeTab === "aco" && userId && <ACOPanel districtResellerId={userId} />}
          {activeTab === "national-surplus" && <NationalSurplusView />}
          {activeTab === "profile" && (
            <div className="max-w-2xl bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-slate-200/50 border border-white overflow-hidden transform hover:-translate-y-1 transition-all duration-300">
              <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50">
                <h3 className="text-xl font-bold text-slate-800">Reseller Profile</h3>
                <p className="text-sm text-slate-500 font-medium">Read-only account information</p>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Email</label>
                  <p className="text-gray-900 font-medium break-all">{profile?.email}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">District Jurisdiction</label>
                  <p className="text-gray-900 font-medium">{profile?.district}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Member Since</label>
                  <p className="text-gray-900 font-medium">
                    {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : ""}
                  </p>
                </div>
                <div className="mt-8 bg-blue-50 border-l-4 border-blue-400 p-4">
                  <div className="flex gap-2">
                    <div className="flex-shrink-0">ℹ️</div>
                    <div className="min-w-0">
                      <p className="text-sm text-blue-700 font-medium">
                        To change your district, log out and log in again selecting a different district. Note: a district can only have one reseller.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-200/50 shadow-[0_-8px_30px_rgba(0,0,0,0.05)] flex z-40 px-2 pb-safe">
          <button
            onClick={() => setActiveTab("inventory")}
            className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider transition-colors duration-300 ${
              activeTab === "inventory"
                ? "text-orange-600 border-t-2 border-orange-600 bg-orange-50/50"
                : "text-slate-500 hover:text-slate-800 border-t-2 border-transparent"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span className="line-clamp-1">Inventory</span>
          </button>
          <button
            onClick={() => setActiveTab("upazilla")}
            className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider transition-colors duration-300 ${
              activeTab === "upazilla"
                ? "text-orange-600 border-t-2 border-orange-600 bg-orange-50/50"
                : "text-slate-500 hover:text-slate-800 border-t-2 border-transparent"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="line-clamp-1">Upazillas</span>
          </button>
          <button
            onClick={() => setActiveTab("transfers")}
            className={`relative flex-1 py-3 px-2 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider transition-colors duration-300 ${
              activeTab === "transfers"
                ? "text-orange-600 border-t-2 border-orange-600 bg-orange-50/50"
                : "text-slate-500 hover:text-slate-800 border-t-2 border-transparent"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span className="line-clamp-1">Transfers</span>
            {showHistoryDot && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("demand")}
            className={`relative flex-1 py-3 px-2 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider transition-colors duration-300 ${
              activeTab === "demand"
                ? "text-orange-600 border-t-2 border-orange-600 bg-orange-50/50"
                : "text-slate-500 hover:text-slate-800 border-t-2 border-transparent"
            }`}
          >
            <BarChart2 className="w-6 h-6" />
            <span className="line-clamp-1">Demand</span>
            {pendingDemandCount > 0 && (
              <span className="absolute top-2 right-2 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white shadow-sm">
                {pendingDemandCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("stock-overview")}
            className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider transition-colors duration-300 ${
              activeTab === "stock-overview"
                ? "text-orange-600 border-t-2 border-orange-600 bg-orange-50/50"
                : "text-slate-500 hover:text-slate-800 border-t-2 border-transparent"
            }`}
          >
            <Package className="w-6 h-6" />
            <span className="line-clamp-1">Stock</span>
          </button>
          <button
            onClick={() => setActiveTab("aco")}
            className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider transition-colors duration-300 ${
              activeTab === "aco"
                ? "text-purple-600 border-t-2 border-purple-600 bg-purple-50/50"
                : "text-slate-500 hover:text-slate-800 border-t-2 border-transparent"
            }`}
          >
            <span className="text-xl h-6 leading-none">🐜</span>
            <span className="line-clamp-1">ACO</span>
          </button>
          <button
            onClick={() => setActiveTab("national-surplus")}
            className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider transition-colors duration-300 ${
              activeTab === "national-surplus"
                ? "text-orange-600 border-t-2 border-orange-600 bg-orange-50/50"
                : "text-slate-500 hover:text-slate-800 border-t-2 border-transparent"
            }`}
          >
            <Globe className="w-6 h-6" />
            <span className="line-clamp-1">National</span>
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider transition-colors duration-300 ${
              activeTab === "profile"
                ? "text-orange-600 border-t-2 border-orange-600 bg-orange-50/50"
                : "text-slate-500 hover:text-slate-800 border-t-2 border-transparent"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="line-clamp-1">Profile</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

export default function DistrictResellerDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
