"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseClient } from "@/lib/supabase";

interface BuyerLoginFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
}

export default function BuyerLoginForm({ onSuccess, redirectTo }: BuyerLoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: signInError } = await supabaseClient.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      // Profile is already synced during signup for buyers, 
      // so we can just redirect them safely.
      if (redirectTo) {
        router.push(redirectTo);
      }
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="login-email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Email
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:border-orange-500"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="login-password"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Password
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:border-orange-500"
          placeholder="Your password"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-400 font-medium transition"
      >
        {isLoading ? "Signing in..." : "Sign in"}
      </button>

      <p className="text-center text-sm text-gray-600">
        New buyer?{" "}
        <Link href="/buyer/register" className="text-orange-500 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
