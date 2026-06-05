"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useCart } from "@/lib/cartContext";

import { supabaseClient } from "@/lib/supabase";

export default function BuyerNavbar() {
  const router = useRouter();
  const { cartCount, setIsCartOpen } = useCart();
  const [user, setUser] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabaseClient.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const handleSearchSubmit = (e: any) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/buyer/search?q=${encodeURIComponent(search)}`);
    }
  };

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    router.push("/");
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo & Search */}
          <div className="flex flex-1 items-center gap-6">
            <Link href="/" className="flex-shrink-0 flex items-center">
              <span className="font-bold text-2xl text-orange-600 tracking-tight">NodeCommerce</span>
            </Link>
            <div className="hidden sm:block flex-1 max-w-md">
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full text-sm focus:ring-orange-500 focus:border-orange-500 bg-gray-50"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
              </form>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-4">

            <button
              onClick={() => setIsCartOpen(true)}
              className="p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition relative"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 flex items-center justify-center h-4 w-4 text-[10px] font-bold text-white bg-orange-600 rounded-full border-2 border-white">
                  {cartCount}
                </span>
              )}
            </button>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 p-1 rounded-full border border-gray-200 hover:bg-gray-50 focus:outline-none"
                >
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                    {user.email?.[0].toUpperCase()}
                  </div>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-100">
                    <Link href="/buyer/dashboard" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      My Dashboard
                    </Link>
                    <Link href="/buyer/dashboard?tab=orders" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      My Orders
                    </Link>
                    <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/buyer/login"
                className="text-sm font-medium text-orange-600 hover:text-orange-500 bg-orange-50 px-4 py-2 rounded-md"
              >
                Log In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
