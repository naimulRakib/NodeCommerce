"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabase";

export default function LocalResellerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "session_expired") {
      setError("Your session expired. Please log in again.");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: signInError } = await supabaseClient.auth.signInWithPassword(
        {
          email: email.trim(),
          password,
        }
      );

      if (signInError) {
        setError(signInError.message);
        return;
      }

      // No profile sync needed here, LocalReseller profile is created during registration
      router.push("/local-reseller/dashboard");
      router.refresh(); // Refresh to ensure session cookies are synced
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-orange-500">
            NodeCommerce
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900 mt-4">
            Local Reseller Login
          </h1>
          <p className="text-gray-600 text-sm mt-2">
            Sign in to your reseller dashboard.
          </p>
        </div>

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
            New reseller?{" "}
            <Link href="/local-reseller/register" className="text-orange-500 hover:underline">
              Create a reseller account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
