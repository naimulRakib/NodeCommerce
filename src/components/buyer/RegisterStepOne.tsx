"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabase";

export default function RegisterStepOne({ data, onChange, onNext }: any) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError("");

    if (data.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (data.password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            fullName: data.fullName,
            phone: data.phone,
            type: "buyer",
          },
        },
      });

      if (authError) {
        if (authError.message.toLowerCase().includes("already registered")) {
          setError("An account with this email already exists. Log in instead?");
        } else {
          setError(authError.message);
        }
        return;
      }

      if (authData?.user) {
        // Unlock step 2
        onChange({ id: authData.user.id });
        onNext();
      }
    } catch (err: any) {
      setError((err instanceof Error ? err.message : String(err)) || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Email Address *</label>
        <input
          type="email"
          required
          value={data.email}
          onChange={(e) => onChange({ email: e.target.value })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Full Name *</label>
        <input
          type="text"
          required
          value={data.fullName}
          onChange={(e) => onChange({ fullName: e.target.value })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Phone (Optional)</label>
        <input
          type="tel"
          value={data.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Password *</label>
        <div className="relative mt-1">
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            value={data.password}
            onChange={(e) => onChange({ password: e.target.value })}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-gray-500 hover:text-gray-700"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Confirm Password *</label>
        <input
          type={showPassword ? "text" : "password"}
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
        />
      </div>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
      >
        {loading ? "Creating Account..." : "Continue →"}
      </button>
    </form>
  );
}
