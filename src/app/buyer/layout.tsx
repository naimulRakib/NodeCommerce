"use client";

import { CartProvider } from "@/lib/cartContext";
import BuyerNavbar from "@/components/layout/BuyerNavbar";
import dynamic from "next/dynamic";

const CartDrawer = dynamic(
  () => import("@/components/buyer/CartDrawer"),
  { ssr: false }
);

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <BuyerNavbar />
      {children}
      <CartDrawer />
    </CartProvider>
  );
}
