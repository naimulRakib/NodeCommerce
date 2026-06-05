"use client";

import { useState, useEffect } from "react";
import { useCart } from "@/lib/cartContext";
import { useRouter } from "next/navigation";
import CartItem from "@/components/buyer/CartItem";
import OrderSummary from "@/components/buyer/OrderSummary";
import OrderConfirmModal from "@/components/buyer/OrderConfirmModal";

export default function CartDrawer() {
  const { isCartOpen, setIsCartOpen, cartItems, updateQuantity, removeFromCart, refreshCart } = useCart();
  const [view, setView] = useState<"cart" | "checkout">("cart");
  const [profile, setProfile] = useState<any>(null);
  const [placedOrders, setPlacedOrders] = useState<string[]>([]);
  const router = useRouter();

  // Load profile when going to checkout
  useEffect(() => {
    let isMounted = true;
    if (view === "checkout") {
      fetch("/api/buyer/profile")
        .then(res => res.json())
        .then(data => {
          if (isMounted && data.profile) setProfile(data.profile);
        })
        .catch(console.error);
    }
    return () => { isMounted = false; };
  }, [view]);

  // Reset view when drawer closes
  useEffect(() => {
    if (!isCartOpen) {
      setTimeout(() => setView("cart"), 300);
    }
  }, [isCartOpen]);

  if (!isCartOpen) return null;

  // Group items by seller
  const grouped = cartItems.reduce((acc: any, item: any) => {
    const seller = item.sellerProduct.seller.storeName || "Unknown Seller";
    if (!acc[seller]) acc[seller] = [];
    acc[seller].push(item);
    return acc;
  }, {});

  const subtotal = cartItems.reduce((sum, item) => sum + (item.sellerProduct.price * item.quantity), 0);

  const handlePlaceOrder = async (note: string) => {
    try {
      const res = await fetch("/api/buyer/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerNote: note })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to place order");
      }
      
      setPlacedOrders(data.orders);
      // Refresh cart immediately so badge clears
      await refreshCart();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const isProfileIncomplete = profile ? (!profile.address || !profile.city || !profile.upazilla || !profile.district) : true;
  const deliveryAddressString = profile 
    ? isProfileIncomplete ? "Incomplete Address - Please update your profile" : `${profile.address}, ${profile.city}, ${profile.upazilla}, ${profile.district}`
    : "Loading address...";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />
      
      <div className="absolute inset-y-0 right-0 max-w-md w-full bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out translate-x-0">
        
        {view === "cart" ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Your Cart</h2>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full hover:bg-gray-100 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                  <svg className="w-24 h-24 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  <div>
                    <p className="text-gray-500 font-medium">Your cart is empty</p>
                    <p className="text-sm text-gray-400 mt-1">Looks like you haven't added anything yet.</p>
                  </div>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="mt-4 px-6 py-2 bg-orange-100 text-orange-600 rounded-full font-medium hover:bg-orange-200 transition"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.keys(grouped).map(sellerName => (
                    <div key={sellerName} className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          {sellerName}
                        </h3>
                      </div>
                      <div className="px-4">
                        {grouped[sellerName].map((item: any) => (
                          <CartItem 
                            key={item.id} 
                            item={item} 
                            onQuantityChange={updateQuantity}
                            onRemove={removeFromCart}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {cartItems.length > 0 && (
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-600 font-medium">Subtotal</span>
                  <span className="text-xl font-bold text-gray-900">৳{subtotal.toLocaleString("en-BD")}</span>
                </div>
                <p className="text-xs text-gray-500 mb-4 text-center">Shipping and taxes calculated at checkout.</p>
                <button
                  onClick={() => setView("checkout")}
                  className="w-full py-3 px-4 bg-orange-600 text-white rounded-md font-bold text-lg hover:bg-orange-700 transition shadow-sm"
                >
                  Proceed to Checkout
                </button>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-full mt-3 py-2 text-sm text-gray-500 font-medium hover:text-gray-800 transition"
                >
                  Continue Shopping
                </button>
              </div>
            )}
          </>
        ) : (
          <OrderSummary 
            cartItems={cartItems} 
            deliveryAddress={deliveryAddressString}
            isProfileIncomplete={isProfileIncomplete}
            onConfirm={handlePlaceOrder}
            onBack={() => setView("cart")}
            onUpdateProfile={() => {
              setIsCartOpen(false);
              router.push("/buyer/dashboard?tab=profile");
            }}
          />
        )}
      </div>

      {placedOrders.length > 0 && (
        <OrderConfirmModal 
          orders={placedOrders} 
          onClose={() => {
            setPlacedOrders([]);
            setIsCartOpen(false);
          }}
          onViewOrders={() => {
            setPlacedOrders([]);
            setIsCartOpen(false);
            router.push("/buyer/dashboard?tab=orders");
          }}
        />
      )}
    </div>
  );
}
