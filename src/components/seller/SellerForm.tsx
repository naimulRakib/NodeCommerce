'use client';

import { useState, useMemo } from 'react';
import { supabaseClient } from '@/lib/supabase';
import { syncProfileToDatabase } from '@/lib/syncProfile';
import { useSellerForm } from './useSellerForm';
import ProgressBar from './ProgressBar';
import StepOne from './StepOne';
import StepTwo from './StepTwo';
import StepThree from './StepThree';
import SuccessScreen from './SuccessScreen';

export default function SellerForm() {
  const form = useSellerForm();
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [validatedFields, setValidatedFields] = useState<Set<string>>(
    new Set()
  );

  const handleFieldBlur = (field: string) => {
    setValidatedFields((prev) => new Set([...prev, field]));
  };

  // Memoize the step completion check
  const isStepComplete = useMemo(() => {
    // Check basic validation without running validateStep (which sets state)
    const { currentStep, formData, errors } = form;

    if (currentStep === 1) {
      return (
        formData.email &&
        formData.password &&
        formData.confirmPassword &&
        !Object.keys(errors).some(key => ['email', 'password', 'confirmPassword'].includes(key))
      );
    } else if (currentStep === 2) {
      return (
        formData.storeName &&
        formData.lat &&
        formData.lng &&
        !Object.keys(errors).some(key => ['storeName', 'lat', 'lng'].includes(key))
      );
    } else if (currentStep === 3) {
      return (
        formData.city &&
        formData.upazilla &&
        !Object.keys(errors).some(key => ['city', 'upazilla'].includes(key))
      );
    }
    return false;
  }, [form]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.currentStep < 3) {
      form.nextStep();
      return;
    }

    // Final step - submit to Supabase
    if (!form.validateStep(3)) return;

    setIsLoading(true);
    setApiError(null);

    try {
      // Sign up with Supabase Auth
      const { data, error } = await supabaseClient.auth.signUp({
        email: form.formData.email,
        password: form.formData.password,
        options: {
          data: {
            store_name: form.formData.storeName,
            lat: form.formData.lat,
            lng: form.formData.lng,
            city: form.formData.city,
            upazilla: form.formData.upazilla,
          },
        },
      });

      if (error) {
        setApiError(error.message || 'Signup failed. Please try again.');
        setIsLoading(false);
        return;
      }

      if (data.session) {
        const sync = await syncProfileToDatabase();
        if (!sync.ok) {
          setApiError(
            sync.error ||
              'Account created but profile could not be saved. Sign in after verifying your email.'
          );
          setIsLoading(false);
          return;
        }
      }

      setShowSuccess(true);
      setIsLoading(false);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : 'An unknown error occurred'
      );
      setIsLoading(false);
    }
  };

  if (showSuccess) {
    return <SuccessScreen email={form.formData.email} />;
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6">
      <ProgressBar currentStep={form.currentStep} />

      {/* Form Content */}
      <div className="bg-white rounded-lg shadow-md p-8 mb-8">
        {form.currentStep === 1 && (
          <StepOne
            formData={form.formData}
            errors={form.errors}
            setField={form.setField}
            onFieldBlur={handleFieldBlur}
          />
        )}

        {form.currentStep === 2 && (
          <StepTwo
            formData={form.formData}
            errors={form.errors}
            setField={form.setField}
            onFieldBlur={handleFieldBlur}
          />
        )}

        {form.currentStep === 3 && (
          <StepThree
            formData={form.formData}
            errors={form.errors}
            setField={form.setField}
            onFieldBlur={handleFieldBlur}
          />
        )}

        {/* API Error Message */}
        {apiError && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{apiError}</p>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-4 justify-between">
        <button
          type="button"
          onClick={form.prevStep}
          disabled={form.currentStep === 1}
          className="px-6 py-3 border border-orange-500 text-orange-500 rounded-md hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
        >
          ← Back
        </button>

        <button
          type="submit"
          disabled={isLoading || !isStepComplete}
          className="px-6 py-3 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="animate-spin">⏳</span>
              Processing...
            </>
          ) : form.currentStep === 3 ? (
            'Create Account'
          ) : (
            'Next →'
          )}
        </button>
      </div>

      {/* Step Indicator */}
      <p className="text-center text-sm text-gray-600 mt-6">
        Step {form.currentStep} of 3
      </p>
    </form>
  );
}
