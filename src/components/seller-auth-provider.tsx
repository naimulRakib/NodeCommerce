"use client";

import { createContext, useContext, useEffect, useState } from "react";
import LoginModal from "@/components/login-modal";
import { supabaseClient } from "@/lib/supabase";

const SellerAuthContext = createContext(null);

export const SELLER_DASHBOARD_PATH = "/seller/dashboard";

export function SellerAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    supabaseClient.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const openLogin = () => setLoginOpen(true);
  const closeLogin = () => setLoginOpen(false);

  const signOut = async () => {
    await supabaseClient.auth.signOut();
    setUser(null);
  };

  return (
    <SellerAuthContext.Provider
      value={{ user, authReady, openLogin, signOut }}
    >
      {children}
      <LoginModal
        open={loginOpen}
        onClose={closeLogin}
        redirectTo={SELLER_DASHBOARD_PATH}
      />
    </SellerAuthContext.Provider>
  );
}

export function useSellerAuth() {
  const ctx = useContext(SellerAuthContext);
  if (!ctx) {
    throw new Error("useSellerAuth must be used within SellerAuthProvider");
  }
  return ctx;
}
