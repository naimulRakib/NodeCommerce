"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabase";
import { DISTRICTS } from "@/data/upazillas";

export default function DistrictResellerRegisterPage() {
  const router = useRouter();

  // Step State
  const [step, setStep] = useState(1);

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [district, setDistrict] = useState("");

  // Errors and UI State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step1Complete, setStep1Complete] = useState(false);

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Valid email is required";
    if (!password || password.length < 6) newErrors.password = "Password must be at least 6 characters";
    if (password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1()) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { type: "district_reseller" } },
      });

      if (error) throw error;
      
      // If auto-confirm is enabled or they successfully signed up, proceed
      if (data.user) {
        setStep1Complete(true);
        setStep(2);
      }
    } catch (err: any) {
      setErrors({ form: (err instanceof Error ? err.message : String(err)) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    if (!district) {
      setErrors({ district: "District is required" });
      return;
    }

    setIsLoading(true);
    try {
      // Call the login API which will create the district reseller profile if it doesn't exist
      const res = await fetch("/api/district-reseller/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ district }),
      });

      if (res.status === 403) {
        throw new Error("This district is already managed by another reseller.");
      }

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to complete setup");
      }

      router.push("/district-reseller/dashboard");
      router.refresh();
    } catch (err: any) {
      setErrors({ form: (err instanceof Error ? err.message : String(err)) });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          District Hub Registration
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Sign up to manage supply chains across your district.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* Progress Indicator */}
          <div className="mb-6 flex items-center justify-center gap-8">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                1
              </div>
              <span className="text-xs mt-1 text-gray-500">Account</span>
            </div>
            <div className="w-12 border-t-2 border-gray-200 mt-[-1rem]"></div>
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                2
              </div>
              <span className="text-xs mt-1 text-gray-500">District</span>
            </div>
          </div>

          {errors.form && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {errors.form}
            </div>
          )}

          {step1Complete && step === 1 && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
              Account created successfully.
              <button onClick={() => setStep(2)} className="mt-2 block w-full text-center text-green-800 font-bold hover:underline">Continue to Step 2 →</button>
            </div>
          )}

          {/* Step 1: Credentials */}
          {step === 1 && !step1Complete && (
            <form onSubmit={handleStep1Submit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email address</label>
                <div className="mt-1">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={validateStep1}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                    placeholder="admin@district.com"
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <div className="mt-1 relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={validateStep1}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-gray-500">
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                <div className="mt-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={validateStep1}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  />
                  {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none disabled:opacity-50"
              >
                {isLoading ? "Creating Account..." : "Continue →"}
              </button>
            </form>
          )}

          {/* Step 2: District Selection */}
          {step === 2 && (
            <form onSubmit={handleStep2Submit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Managed District</label>
                <div className="mt-1">
                  <select
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm bg-white"
                  >
                    <option value="">Select your District</option>
                    {DISTRICTS.map((dist) => (
                      <option key={dist} value={dist}>
                        {dist}
                      </option>
                    ))}
                  </select>
                  {errors.district && <p className="mt-1 text-sm text-red-600">{errors.district}</p>}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                >
                  {isLoading ? "Saving..." : "Enter Dashboard →"}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link href="/district-reseller/login" className="text-sm font-medium text-orange-600 hover:text-orange-500">
              Already have an account? Log in here →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
