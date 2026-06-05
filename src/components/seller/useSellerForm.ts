'use client';

import { useState } from 'react';
import {
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  validateStoreName,
  validateLatitude,
  validateLongitude,
  validateCity,
  validateUpazilla,
} from '@/lib/validation';

export interface SellerFormData {
  email: string;
  password: string;
  confirmPassword: string;
  storeName: string;
  lat: number | string;
  lng: number | string;
  city: string;
  upazilla: string;
}

export interface SellerFormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  storeName?: string;
  lat?: string;
  lng?: string;
  city?: string;
  upazilla?: string;
}

export const useSellerForm = () => {
  const [formData, setFormData] = useState<SellerFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    storeName: '',
    lat: '',
    lng: '',
    city: '',
    upazilla: '',
  });

  const [errors, setErrors] = useState<SellerFormErrors>({});
  const [currentStep, setCurrentStep] = useState(1);

  const setField = (field: keyof SellerFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const validateStep = (step: number): boolean => {
    const stepErrors: SellerFormErrors = {};

    if (step === 1) {
      const emailError = validateEmail(formData.email);
      if (emailError) stepErrors.email = emailError;

      const passwordError = validatePassword(formData.password);
      if (passwordError) stepErrors.password = passwordError;

      const confirmError = validatePasswordMatch(
        formData.password,
        formData.confirmPassword
      );
      if (confirmError) stepErrors.confirmPassword = confirmError;
    } else if (step === 2) {
      const storeError = validateStoreName(formData.storeName);
      if (storeError) stepErrors.storeName = storeError;

      const latError = validateLatitude(formData.lat);
      if (latError) stepErrors.lat = latError;

      const lngError = validateLongitude(formData.lng);
      if (lngError) stepErrors.lng = lngError;
    } else if (step === 3) {
      const cityError = validateCity(formData.city);
      if (cityError) stepErrors.city = cityError;

      const upazillaError = validateUpazilla(formData.upazilla);
      if (upazillaError) stepErrors.upazilla = upazillaError;
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const isStepComplete = (): boolean => {
    return validateStep(currentStep);
  };

  return {
    formData,
    setField,
    errors,
    currentStep,
    nextStep,
    prevStep,
    isStepComplete,
    validateStep,
  };
};
