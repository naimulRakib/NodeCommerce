'use client';

import { useMemo } from 'react';
import { DISTRICTS, getUpazilasForDistrict } from '@/data/upazillas';
import { SellerFormData, SellerFormErrors } from './useSellerForm';

interface StepThreeProps {
  formData: SellerFormData;
  errors: SellerFormErrors;
  setField: (field: keyof SellerFormData, value: string) => void;
  onFieldBlur: (field: keyof SellerFormData) => void;
}

export default function StepThree({
  formData,
  errors,
  setField,
  onFieldBlur,
}: StepThreeProps) {
  const upazilas = useMemo(
    () => getUpazilasForDistrict(formData.city),
    [formData.city]
  );

  const handleDistrictChange = (district: string) => {
    setField('city', district);
    if (formData.upazilla && !getUpazilasForDistrict(district).includes(formData.upazilla)) {
      setField('upazilla', '');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold">Store Location Details</h2>

      <div>
        <label
          htmlFor="district"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          District *
        </label>
        <select
          id="district"
          value={formData.city}
          onChange={(e) => handleDistrictChange(e.target.value)}
          onBlur={() => onFieldBlur('city')}
          className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:border-orange-500 bg-white ${
            errors.city ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          <option value="">Select your district</option>
          {DISTRICTS.map((district) => (
            <option key={district} value={district}>
              {district}
            </option>
          ))}
        </select>
        {errors.city && (
          <p className="text-red-500 text-xs mt-1">{errors.city}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="upazilla"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Upazilla / Sub-district *
        </label>
        <select
          id="upazilla"
          value={formData.upazilla}
          onChange={(e) => setField('upazilla', e.target.value)}
          onBlur={() => onFieldBlur('upazilla')}
          disabled={!formData.city}
          className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:border-orange-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed ${
            errors.upazilla ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          <option value="">
            {formData.city
              ? 'Select your upazilla'
              : 'Select a district first'}
          </option>
          {upazilas.map((upazilla) => (
            <option key={upazilla} value={upazilla}>
              {upazilla}
            </option>
          ))}
        </select>
        {errors.upazilla && (
          <p className="text-red-500 text-xs mt-1">{errors.upazilla}</p>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-2">
        * Required fields. This information helps us serve you better.
      </p>
    </div>
  );
}
