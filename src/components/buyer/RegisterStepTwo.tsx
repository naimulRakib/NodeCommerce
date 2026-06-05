"use client";

import { useMemo, useState } from "react";
import { DISTRICTS, getUpazilasForDistrict } from "@/data/upazillas";

export default function RegisterStepTwo({ data, onChange, onSubmit, loading }: any) {
  const [locating, setLocating] = useState(false);

  const districts = DISTRICTS;

  const filteredUpazillas = useMemo(() => {
    if (!data.district) return [];
    return getUpazilasForDistrict(data.district).sort();
  }, [data.district]);

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        alert("Unable to retrieve your location");
        setLocating(false);
      }
    );
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
      <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm mb-4">
        Check your email to verify your account, then continue below. You can complete registration before clicking the link.
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Delivery Address *</label>
        <textarea
          required
          rows={3}
          value={data.address}
          onChange={(e) => onChange({ address: e.target.value })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
          placeholder="House/Flat No, Street Name"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">District *</label>
          <select
            required
            value={data.district}
            onChange={(e) => onChange({ district: e.target.value, upazilla: "" })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
          >
            <option value="">Select District</option>
            {districts.map((d: any) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Upazilla/Area *</label>
          <select
            required
            disabled={!data.district}
            value={data.upazilla}
            onChange={(e) => onChange({ upazilla: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500 disabled:bg-gray-100"
          >
            <option value="">Select Upazilla</option>
            {filteredUpazillas.map((u: any) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">City *</label>
        <input
          type="text"
          required
          value={data.city}
          onChange={(e) => onChange({ city: e.target.value })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
        />
      </div>

      <div className="pt-2">
        <label className="block text-sm font-medium text-gray-700 mb-2">Location Coordinates (Optional)</label>
        <div className="flex gap-4 items-center">
          <input
            type="number"
            step="any"
            placeholder="Latitude"
            value={data.lat || ""}
            onChange={(e) => onChange({ lat: e.target.value })}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
          />
          <input
            type="number"
            step="any"
            placeholder="Longitude"
            value={data.lng || ""}
            onChange={(e) => onChange({ lng: e.target.value })}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
          />
          <button
            type="button"
            onClick={handleUseLocation}
            disabled={locating}
            className="whitespace-nowrap px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md disabled:opacity-50"
          >
            {locating ? "Locating..." : "Use My Location"}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-6 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
      >
        {loading ? "Completing Registration..." : "Complete Registration →"}
      </button>
    </form>
  );
}
