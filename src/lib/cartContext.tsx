"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { detectRoleFromPath, getRoleLoginPath } from "@/lib/role-redirect";

interface CartItem {
  id: string;
  quantity: number;
  [key: string]: any;
}

interface CartContextType {
  cartItems: CartItem[];
  cartCount: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (sellerProductId: string, quantity?: number) => Promise<void>;
  removeFromCart: (cartItemId: string) => Promise<void>;
  updateQuantity: (cartItemId: string, qty: number) => Promise<void>;
  refreshCart: () => Promise<void>;
  /** UI components override this to surface errors (e.g. via a toast). */
  notifyError: (message: string) => void;
  setNotifyError: (fn: (message: string) => void) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const defaultNotify = (msg: string) => {
  // Fallback: console only. Callers should override via setNotifyError.
  console.warn("[cart]", msg);
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [notifyError, setNotifyErrorState] = useState<(m: string) => void>(
    () => defaultNotify,
  );

  // Single source of truth: cartCount is always derived from cartItems.
  // Eliminates the "removeFromCart decrements by 1" desync bug.
  const cartCount = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.quantity, 0),
    [cartItems],
  );

  // Per-mutation request IDs guard against double-clicks producing two
  // addToCart() calls that race against each other.
  const inFlight = useRef(0);

  const setNotifyError = useCallback((fn: (m: string) => void) => {
    setNotifyErrorState(() => fn);
  }, []);

  const redirectToRoleLogin = useCallback(() => {
    if (typeof window === "undefined") return;
    const role = detectRoleFromPath(window.location.pathname);
    const target = role ? getRoleLoginPath(role) : "/buyer/login";
    window.location.href = target;
  }, []);

  const refreshCart = useCallback(async () => {
    try {
      const res = await fetch("/api/buyer/cart");
      if (!res.ok) {
        setCartItems([]);
        return;
      }
      const data = await res.json();
      setCartItems(data.items || []);
    } catch (err) {
      // Network error — leave existing state intact, do nothing.
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const res = await fetch("/api/buyer/cart");
        if (!isMounted || !res || !res.ok) return;
        const data = await res.json();
        if (isMounted) setCartItems(data.items || []);
      } catch {
        // Ignore — the user might just be unauthenticated.
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const addToCart = useCallback(
    async (sellerProductId: string, quantity = 1) => {
      const requestId = ++inFlight.current;
      const optimisticItem: CartItem = {
        id: `optimistic-${requestId}`,
        quantity,
        sellerProductId,
        _optimistic: true,
      };

      // Optimistic UI update
      setCartItems((prev) => [...prev, optimisticItem]);

      try {
        const res = await fetch("/api/buyer/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sellerProductId, quantity }),
        });

        if (res.status === 401) {
          // Roll back optimistic insert, then redirect to the right login.
          setCartItems((prev) =>
            prev.filter((i) => i.id !== optimisticItem.id),
          );
          redirectToRoleLogin();
          return;
        }

        if (!res.ok) {
          const errBody = await res.text();
          let message = "Failed to add to cart";
          try {
            const parsed = JSON.parse(errBody);
            if (parsed?.error) message = parsed.error;
          } catch {
            // not JSON, keep default
          }
          throw new Error(message);
        }

        const data = await res.json().catch(() => ({}));
        // Replace the optimistic row with the server-issued item so future
        // updates (e.g. PATCH /api/buyer/cart/[id]) hit a real id.
        setCartItems((prev) => {
          const next = prev.filter((i) => i.id !== optimisticItem.id);
          if (data?.item) next.push(data.item);
          return next;
        });

        if (requestId === inFlight.current) {
          setIsCartOpen(true);
        }
      } catch (err) {
        setCartItems((prev) =>
          prev.filter((i) => i.id !== optimisticItem.id),
        );
        notifyError(
          err instanceof Error ? err.message : "Failed to add to cart",
        );
      }
    },
    [notifyError, redirectToRoleLogin],
  );

  const removeFromCart = useCallback(
    async (cartItemId: string) => {
      const target = cartItems.find((i) => i.id === cartItemId);
      if (!target) return;

      // Optimistic: drop the item; the count is derived, so it updates itself.
      setCartItems((prev) => prev.filter((item) => item.id !== cartItemId));

      try {
        const res = await fetch(`/api/buyer/cart/${cartItemId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          throw new Error("Failed to remove item");
        }
        // Server confirmed — nothing else to do, state is already correct.
        // (intentionally not calling refreshCart: avoids the double round-trip
        //  and the "stale data contradicts the alert" bug.)
      } catch (err) {
        // Roll back the optimistic removal
        setCartItems((prev) => [...prev, target]);
        notifyError(
          err instanceof Error ? err.message : "Failed to remove item",
        );
      }
    },
    [cartItems, notifyError],
  );

  const updateQuantity = useCallback(
    async (cartItemId: string, qty: number) => {
      if (qty <= 0) {
        return removeFromCart(cartItemId);
      }

      const previous = cartItems.find((i) => i.id === cartItemId);
      if (!previous) return;

      // Optimistic quantity update
      setCartItems((prev) =>
        prev.map((item) =>
          item.id === cartItemId ? { ...item, quantity: qty } : item,
        ),
      );

      try {
        const res = await fetch(`/api/buyer/cart/${cartItemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: qty }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update quantity");
        }
        // Server confirmed — no refresh needed.
      } catch (err) {
        // Roll back
        setCartItems((prev) =>
          prev.map((item) => (item.id === cartItemId ? previous : item)),
        );
        notifyError(
          err instanceof Error ? err.message : "Failed to update quantity",
        );
      }
    },
    [cartItems, notifyError, removeFromCart],
  );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        removeFromCart,
        updateQuantity,
        refreshCart,
        notifyError,
        setNotifyError,
      }}
    >
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
