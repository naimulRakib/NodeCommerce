'use client';

import { useState } from 'react';
import { SellerFormData, SellerFormErrors } from './useSellerForm';

interface StepTwoProps {
  formData: SellerFormData;
  errors: SellerFormErrors;
  setField: (field: keyof SellerFormData, value: SellerFormData[keyof SellerFormData]) => void;

  onFieldBlur: (field: keyof SellerFormData) => void;
}

export default function StepTwo({
  formData,
  errors,
  setField,
  onFieldBlur,
}: StepTwoProps) {
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setLoadingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setField('lat', position.coords.latitude);
        setField('lng', position.coords.longitude);
        setLoadingLocation(false);
      },
      (error) => {
        setLocationError('Unable to get your location. Please enter manually.');
        setLoadingLocation(false);
      }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold">Store Information</h2>

      {/* Store Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Store Name *
        </label>
        <input
          type="text"
          value={formData.storeName}
          onChange={(e) => setField('storeName', e.target.value)}
          onBlur={() => onFieldBlur('storeName')}
          placeholder="e.g. My Amazing Store"
          className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:border-orange-500 ${
            errors.storeName ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.storeName && (
          <p className="text-red-500 text-xs mt-1">{errors.storeName}</p>
        )}
      </div>

      {/* Location Section */}
      <div className="border-t pt-6">
        <h3 className="text-sm font-medium text-gray-700 mb-4">
          Store Location
        </h3>

        {/* Use My Location Button */}
        <button
          type="button"
          onClick={handleUseLocation}
          disabled={loadingLocation}
          className="w-full mb-4 px-4 py-3 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-400 font-medium text-sm transition"
        >
          {loadingLocation ? '📍 Getting your location...' : '📍 Use My Location'}
        </button>

        {locationError && (
          <p className="text-orange-600 text-xs mb-4 bg-orange-50 p-2 rounded">
            {locationError}
          </p>
        )}

        {/* Latitude */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Latitude (e.g. 23.8103) *
          </label>
          <input
            type="number"
            step="0.0001"
            value={formData.lat}
            onChange={(e) => setField('lat', e.target.value)}
            onBlur={() => onFieldBlur('lat')}
            placeholder="23.8103"
            className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:border-orange-500 ${
              errors.lat ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.lat && (
            <p className="text-red-500 text-xs mt-1">{errors.lat}</p>
          )}
        </div>

        {/* Longitude */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Longitude (e.g. 90.4125) *
          </label>
          <input
            type="number"
            step="0.0001"
            value={formData.lng}
            onChange={(e) => setField('lng', e.target.value)}
            onBlur={() => onFieldBlur('lng')}
            placeholder="90.4125"
            className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:border-orange-500 ${
              errors.lng ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.lng && (
            <p className="text-red-500 text-xs mt-1">{errors.lng}</p>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-2">
        * Required fields. Your store location helps customers find you.
      </p>
    </div>
  );
}
