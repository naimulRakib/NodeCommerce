'use client';

import { useState } from 'react';
import { SellerFormData, SellerFormErrors } from './useSellerForm';

interface StepOneProps {
  formData: SellerFormData;
  errors: SellerFormErrors;
  setField: (field: keyof SellerFormData, value: SellerFormData[keyof SellerFormData]) => void;

  onFieldBlur: (field: keyof SellerFormData) => void;
}

export default function StepOne({
  formData,
  errors,
  setField,
  onFieldBlur,
}: StepOneProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold">Create Your Account</h2>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email Address *
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setField('email', e.target.value)}
          onBlur={() => onFieldBlur('email')}
          placeholder="your@email.com"
          className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:border-orange-500 ${
            errors.email ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.email && (
          <p className="text-red-500 text-xs mt-1">{errors.email}</p>
        )}
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Password *
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => setField('password', e.target.value)}
            onBlur={() => onFieldBlur('password')}
            placeholder="Min 8 characters"
            className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:border-orange-500 ${
              errors.password ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-3 text-gray-500 text-sm hover:text-gray-700"
          >
            {showPassword ? '🙈 Hide' : '👁️ Show'}
          </button>
        </div>
        {errors.password && (
          <p className="text-red-500 text-xs mt-1">{errors.password}</p>
        )}
      </div>

      {/* Confirm Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Confirm Password *
        </label>
        <div className="relative">
          <input
            type={showConfirm ? 'text' : 'password'}
            value={formData.confirmPassword}
            onChange={(e) => setField('confirmPassword', e.target.value)}
            onBlur={() => onFieldBlur('confirmPassword')}
            placeholder="Re-enter your password"
            className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:border-orange-500 ${
              errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-3 text-gray-500 text-sm hover:text-gray-700"
          >
            {showConfirm ? '🙈 Hide' : '👁️ Show'}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-2">
        * Required fields. Password must be at least 8 characters long.
      </p>
    </div>
  );
}
