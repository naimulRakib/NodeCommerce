"use client";

import { SellerAuthProvider } from "@/components/seller-auth-provider";
import { CartProvider } from "@/lib/cartContext";

export default function HomeShell({ children }) {
  return (
    <SellerAuthProvider>
      <CartProvider>
        {children}
      </CartProvider>
    </SellerAuthProvider>
  );
}
