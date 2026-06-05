"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabase";
import InventoryTable from "@/components/local-reseller/InventoryTable";
import DeliverySection from "@/components/local-reseller/DeliverySection";
import ProfileSection from "@/components/local-reseller/ProfileSection";
import IncomingStockPanel from "@/components/local-reseller/IncomingStockPanel";

export default function LocalResellerDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("inventory");
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [hasPendingTransfers, setHasPendingTransfers] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      try {
        const { data } = await supabaseClient.auth.getUser();
        if (!data.user) {
          router.replace("/local-reseller/login");
          return;
        }
        
        const res = await fetch("/api/local-reseller/profile");
        if (res.status === 404 || res.status === 403) {
          router.replace("/local-reseller/register");
          return;
        }
        // Check for pending transfers
        const transfersRes = await fetch("/api/local-reseller/transfers");
        if (transfersRes.ok) {
          const transfersData = await transfersRes.json();
          if (isMounted) {
            setHasPendingTransfers(transfersData.some((t: any) => t.status === "pending"));
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoadingAuth(false);
      }
    }
    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    router.push("/local-reseller/login");
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/" className="text-xl font-bold text-orange-600">
                  NodeCommerce
                </Link>
                <span className="ml-3 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                  Local Reseller
                </span>
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleLogout}
                className="ml-4 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Reseller Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your assigned inventory, track deliveries, and update your profile.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="sm:hidden">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm rounded-md"
            >
              <option value="inventory">Inventory</option>
              <option value="incoming">Incoming Stock</option>
              <option value="delivery">Delivery</option>
              <option value="profile">Profile</option>
            </select>
          </div>
          <div className="hidden sm:block">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab("inventory")}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === "inventory"
                      ? "border-orange-500 text-orange-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Assigned Inventory
                </button>

                <button
                  onClick={() => setActiveTab("incoming")}
                  className={`relative whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === "incoming"
                      ? "border-orange-500 text-orange-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                  Incoming Stock
                  {hasPendingTransfers && (
                    <span className="absolute top-3 -right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab("delivery")}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === "delivery"
                      ? "border-orange-500 text-orange-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Delivery Management
                </button>

                <button
                  onClick={() => setActiveTab("profile")}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === "profile"
                      ? "border-orange-500 text-orange-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Reseller Profile
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-4">
          {activeTab === "inventory" && <InventoryTable />}
          {activeTab === "incoming" && <IncomingStockPanel />}
          {activeTab === "delivery" && <DeliverySection />}
          {activeTab === "profile" && (
            <div className="max-w-3xl">
              <ProfileSection />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
