"use client";

import { CartProvider } from "@/lib/cartContext";
import BuyerNavbar from "@/components/layout/BuyerNavbar";
import CartDrawer from "@/components/buyer/CartDrawer";

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <BuyerNavbar />
      {children}
      <CartDrawer />
    </CartProvider>
  );
}
