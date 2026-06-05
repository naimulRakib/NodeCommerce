"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

interface CartContextType {
  cartItems: any[];
  cartCount: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (sellerProductId: string, quantity?: number) => Promise<void>;
  removeFromCart: (cartItemId: string) => Promise<void>;
  updateQuantity: (cartItemId: string, qty: number) => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const refreshCart = useCallback(async () => {
    try {
      const res = await fetch("/api/buyer/cart");
      if (res.ok) {
        const data = await res.json();
        setCartItems(data.items || []);
        setCartCount((data.items || []).reduce((acc: number, item: any) => acc + item.quantity, 0));
      } else {
        // User not logged in or wrong role — clear cart state silently
        setCartItems([]);
        setCartCount(0);
      }
    } catch (err) {
      // Network error — do nothing
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const res = await fetch("/api/buyer/cart").catch(() => null);
      if (!isMounted || !res || !res.ok) return;
      const data = await res.json();
      if (isMounted) {
        setCartItems(data.items || []);
        setCartCount((data.items || []).reduce((acc: number, item: any) => acc + item.quantity, 0));
      }
    };
    init();
    return () => { isMounted = false; };
  }, []);

  const addToCart = async (sellerProductId: string, quantity = 1) => {
    try {
      const res = await fetch("/api/buyer/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerProductId, quantity })
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/buyer/login";
          return;
        }
        
        const text = await res.text();
        try {
          const errData = JSON.parse(text);
          throw new Error(errData.error || "Failed to add to cart");
        } catch (e) {
          throw new Error("Server error. Please try again or log in as a buyer.");
        }
      }

      await res.json();
      await refreshCart();
      setIsCartOpen(true); // Open drawer on add
    } catch (err: any) {
      alert(err.message || "Failed to add to cart");
    }
  };

  const removeFromCart = async (cartItemId: string) => {
    try {
      // Optimistic update
      setCartItems(prev => prev.filter(item => item.id !== cartItemId));
      setCartCount(prev => Math.max(0, prev - 1));
      
      const res = await fetch(`/api/buyer/cart/${cartItemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove item");
      await refreshCart();
    } catch (err: any) {
      alert(err.message || "Failed to remove item");
      await refreshCart(); // Revert on error
    }
  };

  const updateQuantity = async (cartItemId: string, qty: number) => {
    if (qty <= 0) return removeFromCart(cartItemId);
    
    try {
      // Optimistic update
      setCartItems(prev => prev.map(item => item.id === cartItemId ? { ...item, quantity: qty } : item));
      
      const res = await fetch(`/api/buyer/cart/${cartItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update quantity");
      await refreshCart();
    } catch (err: any) {
      alert(err.message || "Failed to update quantity");
      await refreshCart(); // Revert on error
    }
  };

  return (
    <CartContext.Provider value={{
      cartItems,
      cartCount,
      isCartOpen,
      setIsCartOpen,
      addToCart,
      removeFromCart,
      updateQuantity,
      refreshCart
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
