"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabase";
import bdLocations from "@/data/bangladesh-locations.json";

export default function LocalResellerRegister() {
  const router = useRouter();
  
  // Step State
  const [step, setStep] = useState(1);
  
  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [username, setUsername] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  
  const [city, setCity] = useState("");
  const [upazilla, setUpazilla] = useState("");
  
  // Errors and UI State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step1Complete, setStep1Complete] = useState(false);
  const [authId, setAuthId] = useState("");

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Valid email is required";
    if (!password || password.length < 8) newErrors.password = "Password must be at least 8 characters";
    if (password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    if (!username.trim()) newErrors.username = "Store name is required";
    if (!lat || isNaN(Number(lat))) newErrors.lat = "Valid latitude is required";
    if (!lng || isNaN(Number(lng))) newErrors.lng = "Valid longitude is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors: Record<string, string> = {};
    if (!city.trim()) newErrors.city = "City is required";
    if (!upazilla) newErrors.upazilla = "Upazilla is required";
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
        options: { data: { type: "local_reseller" } },
      });

      if (error) throw error;
      if (data.user) {
        setAuthId(data.user.id);
        setStep1Complete(true);
        setStep(2);
      }
    } catch (err: any) {
      setErrors({ form: (err instanceof Error ? err.message : String(err)) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep2()) setStep(3);
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep3()) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/local-reseller/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: authId,
          email,
          username,
          lat: Number(lat),
          lng: Number(lng),
          city,
          upazilla
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.push("/local-reseller/login?error=session_expired");
          return;
        }
        const errorData = await res.json();
        throw new Error(errorData.error || "Registration failed");
      }

      router.push("/local-reseller/dashboard");
    } catch (err: any) {
      setErrors({ form: (err instanceof Error ? err.message : String(err)) });
      setIsLoading(false);
    }
  };

  const handleGetLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude.toString());
          setLng(position.coords.longitude.toString());
        },
        (err) => {
          setErrors({ ...errors, location: "Could not fetch location automatically." });
        }
      );
    } else {
      setErrors({ ...errors, location: "Geolocation is not supported by your browser." });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Local Reseller Registration
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Note: This is a reseller account, not a main seller account.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* Progress Indicator */}
          <div className="mb-6 flex items-center justify-between">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step >= num ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {num}
                </div>
                <span className="text-xs mt-1 text-gray-500">Step {num}</span>
              </div>
            ))}
          </div>

          {errors.form && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {errors.form}
            </div>
          )}

          {step1Complete && step === 1 && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
              Check your email to verify your account, then continue below.
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
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
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
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
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
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  />
                  {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none disabled:opacity-50"
              >
                {isLoading ? "Processing..." : "Continue →"}
              </button>
            </form>
          )}

          {/* Step 2: Reseller Info */}
          {step === 2 && (
            <form onSubmit={handleStep2Submit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Reseller / Store Name</label>
                <div className="mt-1">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onBlur={validateStep2}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  />
                  {errors.username && <p className="mt-1 text-sm text-red-600">{errors.username}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    onBlur={validateStep2}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  />
                  {errors.lat && <p className="mt-1 text-sm text-red-600">{errors.lat}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    onBlur={validateStep2}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  />
                  {errors.lng && <p className="mt-1 text-sm text-red-600">{errors.lng}</p>}
                </div>
              </div>
              
              <button
                type="button"
                onClick={handleGetLocation}
                className="w-full text-sm text-orange-600 border border-orange-600 py-2 rounded-md hover:bg-orange-50"
              >
                Use My Location
              </button>
              {errors.location && <p className="mt-1 text-sm text-red-600">{errors.location}</p>}

              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700"
              >
                Continue →
              </button>
            </form>
          )}

          {/* Step 3: Location */}
          {step === 3 && (
            <form onSubmit={handleStep3Submit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">City (District)</label>
                <div className="mt-1">
                  <select
                    required
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setUpazilla(""); // Reset upazilla on city change
                    }}
                    onBlur={validateStep3}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm bg-white"
                  >
                    <option value="">Select a District</option>
                    {Object.keys(bdLocations).sort().map(dist => (
                      <option key={dist} value={dist}>{dist}</option>
                    ))}
                  </select>
                  {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Upazilla</label>
                <div className="mt-1">
                  <select
                    required
                    value={upazilla}
                    onChange={(e) => setUpazilla(e.target.value)}
                    onBlur={validateStep3}
                    disabled={!city}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm bg-white disabled:opacity-50"
                  >
                    <option value="">Select an Upazilla</option>
                    {city && (bdLocations as any)[city]?.sort().map((upz: string) => (
                      <option key={upz} value={upz}>{upz}</option>
                    ))}
                  </select>
                  {errors.upazilla && <p className="mt-1 text-sm text-red-600">{errors.upazilla}</p>}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-1/3 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-2/3 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                >
                  {isLoading ? "Saving..." : "Complete Registration →"}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link href="/local-reseller/login" className="text-sm font-medium text-orange-600 hover:text-orange-500">
              Already have an account? Log in →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
