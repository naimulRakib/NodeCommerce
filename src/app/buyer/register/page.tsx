"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RegisterStepOne from "@/components/buyer/RegisterStepOne";
import RegisterStepTwo from "@/components/buyer/RegisterStepTwo";

export default function BuyerRegistrationPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    id: "", // from auth
    email: "",
    password: "",
    fullName: "",
    phone: "",
    address: "",
    city: "",
    district: "",
    upazilla: "",
    lat: "",
    lng: "",
  });

  const handleChange = (updates: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleComplete = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/buyer/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to complete registration");
      }

      router.push("/buyer/dashboard");
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create a Buyer Account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Step {step} of 2
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {step === 1 ? (
            <RegisterStepOne
              data={formData}
              onChange={handleChange}
              onNext={() => setStep(2)}
            />
          ) : (
            <RegisterStepTwo
              data={formData}
              onChange={handleChange}
              onSubmit={handleComplete}
              loading={loading}
            />
          )}

          <div className="mt-6 text-center text-sm">
            <Link
              href="/buyer/login"
              className="font-medium text-orange-600 hover:text-orange-500"
            >
              Already have an account? Log in
            </Link>
          </div>
          <div className="mt-2 text-center text-sm">
            <Link
              href="/seller/register"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Are you a seller? Register here →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
