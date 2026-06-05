"use client";

import Link from "next/link";
import {
  SELLER_DASHBOARD_PATH,
  useSellerAuth,
} from "@/components/seller-auth-provider";

export default function SellerHomeBanner() {
  const { user, openLogin } = useSellerAuth();

  return (
    <section className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold">
            Sell on NodeCommerce Bangladesh
          </h2>
          <p className="text-orange-100 text-sm mt-1">
            Register your store, manage inventory, and generate product QR codes.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {user ? (
            <Link
              href={SELLER_DASHBOARD_PATH}
              className="px-5 py-2.5 bg-white text-orange-600 font-semibold rounded-md hover:bg-orange-50 transition text-center"
            >
              Go to Seller Dashboard
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={openLogin}
                className="px-5 py-2.5 bg-white text-orange-600 font-semibold rounded-md hover:bg-orange-50 transition"
              >
                Seller Login
              </button>
              <Link
                href="/seller"
                className="px-5 py-2.5 border-2 border-white text-white font-semibold rounded-md hover:bg-orange-600 transition text-center"
              >
                Seller Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
