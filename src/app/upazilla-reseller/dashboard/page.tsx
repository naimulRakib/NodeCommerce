"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabase";
import InventorySection from "@/components/upazilla-reseller/InventorySection";
import LocalResellerMonitor from "@/components/upazilla-reseller/LocalResellerMonitor";
import TransferHistoryTable from "@/components/upazilla-reseller/TransferHistoryTable";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const initialTab = searchParams.get("tab") || "inventory";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [profile, setProfile] = useState<{ email: string; city: string; upazilla: string; createdAt: string } | null>(null);
  const [hasPendingTransfers, setHasPendingTransfers] = useState(false);

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
    if (activeTab !== searchParams.get("tab")) {
      router.replace(`/upazilla-reseller/dashboard?tab=${activeTab}`, { scroll: false });
    }
  }, [activeTab, router, searchParams]);

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
      <aside className="hidden md:flex flex-col w-64 bg-gray-900 text-white min-h-screen fixed z-20">
        <div className="p-6 border-b border-gray-800">
          <Link href="/" className="text-xl font-bold text-orange-500 mb-4 block">
            NodeCommerce
          </Link>
          <div className="bg-gray-800 px-3 py-2 rounded-md">
            <span className="block text-xs font-semibold text-orange-400 uppercase tracking-wider mb-1">Upazilla Reseller</span>
            <span className="block text-sm font-medium text-white truncate">{profile?.email || "Loading..."}</span>
            <span className="block text-xs text-gray-400 truncate mt-0.5">{profile ? `${profile.city}, ${profile.upazilla}` : "Loading..."}</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 flex flex-col gap-2">
          <button onClick={() => setActiveTab("inventory")} className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition ${activeTab === 'inventory' ? 'bg-orange-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            Inventory
          </button>
          
          <button onClick={() => setActiveTab("resellers")} className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition ${activeTab === 'resellers' ? 'bg-orange-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Local Resellers
          </button>

          <button onClick={() => setActiveTab("transfers")} className={`relative flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition ${activeTab === 'transfers' ? 'bg-orange-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            Transfer History
            {hasPendingTransfers && (
              <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </button>

          <button onClick={() => setActiveTab("profile")} className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition ${activeTab === 'profile' ? 'bg-orange-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Profile
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-gray-900">Upazilla Reseller Dashboard</h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 mb-16 md:mb-0">
          {activeTab === "inventory" && <InventorySection />}
          {activeTab === "resellers" && <LocalResellerMonitor />}
          {activeTab === "transfers" && <TransferHistoryTable />}
          {activeTab === "profile" && (
            <div className="max-w-2xl bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">Reseller Profile</h3>
                <p className="text-sm text-gray-500">Read-only account information</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Email</label>
                  <p className="text-gray-900 font-medium">{profile?.email}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="flex">
                    <div className="flex-shrink-0">ℹ️</div>
                    <div className="ml-3">
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
        <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 flex z-20">
          <button onClick={() => setActiveTab("inventory")} className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider ${activeTab === 'inventory' ? 'text-orange-600' : 'text-gray-500 hover:text-gray-900'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            Inventory
          </button>
          <button onClick={() => setActiveTab("resellers")} className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider ${activeTab === 'resellers' ? 'text-orange-600' : 'text-gray-500 hover:text-gray-900'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Resellers
          </button>
          <button onClick={() => setActiveTab("transfers")} className={`relative flex-1 py-3 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider ${activeTab === 'transfers' ? 'text-orange-600' : 'text-gray-500 hover:text-gray-900'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            Transfers
            {hasPendingTransfers && (
              <span className="absolute top-2 right-1/4 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </button>
          <button onClick={() => setActiveTab("profile")} className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] uppercase font-bold tracking-wider ${activeTab === 'profile' ? 'text-orange-600' : 'text-gray-500 hover:text-gray-900'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Profile
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
