"use client";

import Link from "next/link";
import {
  SELLER_DASHBOARD_PATH,
  useSellerAuth,
} from "@/components/seller-auth-provider";

export default function TopAuthBar() {
  const { user, authReady, openLogin, signOut } = useSellerAuth();

  return (
    <div className="flex gap-4 items-center flex-wrap justify-center">
      <Link href="#">Save more on App</Link>
      <Link href="/seller">Sell on NodeCommerce</Link>
      <Link href="#">Customer Care</Link>
      <Link href="#">Track my Order</Link>
      
      {authReady ? (
        user ? (
          <>
            <Link
              href="/buyer/dashboard"
              className="font-medium text-orange-600 hover:text-orange-700"
            >
              Buyer Dashboard
            </Link>
            <Link
              href={SELLER_DASHBOARD_PATH}
              className="font-medium text-orange-600 hover:text-orange-700"
            >
              Seller Dashboard
            </Link>
            <span className="text-gray-700">
              Hi, {user.user_metadata?.store_name || user.email?.split("@")[0]}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="hover:text-orange-500"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link href="/buyer/login" className="hover:text-orange-500 font-medium">
              Buyer Login
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/buyer/register" className="hover:text-orange-500 font-medium">
              Buyer Sign Up
            </Link>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={openLogin}
              className="hover:text-orange-500 font-medium"
            >
              Seller Login
            </button>
            <span className="text-gray-300">|</span>
            <Link href="/seller" className="hover:text-orange-500 font-medium">
              Seller Sign up
            </Link>
          </>
        )
      ) : (
        <div className="w-48"></div> /* Placeholder during hydration/auth loading */
      )}
    </div>
  );
}
