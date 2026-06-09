import React, { useState, useEffect } from "react";
// @ts-ignore
import DISTRICT_CENTROIDS_RAW from "@/data/district-centroids.js";

const DISTRICT_CENTROIDS = DISTRICT_CENTROIDS_RAW as Record<string, { lat: number; lng: number }>;

const ALTERNATE_SPELLINGS = [
  "Chattogram",
  "Coxsbazar",
  "Coxs Bazar",
  "Bogura",
  "Jashore",
  "Barishal",
  "Narayangonj",
  "Munsiganj",
  "Jhalakathi",
  "Hobiganj",
];

// Deduplicated list of standard districts
const DISTRICT_LIST = Object.keys(DISTRICT_CENTROIDS)
  .filter((d) => !ALTERNATE_SPELLINGS.includes(d))
  .sort();

interface SearchFilterProps {
  onSearch: (query: string) => void;
  onFilterDistrict: (district: string) => void;
  onFilterType: (type: string) => void;
}

export default function SearchFilter({
  onSearch,
  onFilterDistrict,
  onFilterType,
}: SearchFilterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedType, setSelectedType] = useState("");

  // Debounced search query
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(searchQuery);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery, onSearch]);

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedDistrict(val);
    onFilterDistrict(val);
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedType(val);
    onFilterType(val);
  };

  const handleClear = () => {
    setSearchQuery("");
    setSelectedDistrict("");
    setSelectedType("");
    onSearch("");
    onFilterDistrict("");
    onFilterType("");
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      {/* Title */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <span className="text-xl">🔍</span>
        <h3 className="font-bold text-slate-800 tracking-tight text-base">
          Search & Filters
        </h3>
      </div>

      <div className="flex flex-col gap-3">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search by name, city, upazilla..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-700 placeholder-slate-400 transition-all duration-200"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">
            🔍
          </span>
        </div>

        {/* Filters Dropdowns (District + Type) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* District Dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase pl-1">
              District
            </label>
            <select
              value={selectedDistrict}
              onChange={handleDistrictChange}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-700 transition-all duration-200"
            >
              <option value="">All Districts</option>
              {DISTRICT_LIST.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </div>

          {/* Type Dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase pl-1">
              Node Type
            </label>
            <select
              value={selectedType}
              onChange={handleTypeChange}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-700 transition-all duration-200"
            >
              <option value="">All Types</option>
              <option value="seller">Seller</option>
              <option value="local_reseller">Local Reseller</option>
              <option value="upazilla_reseller">Upazilla Reseller</option>
              <option value="district_reseller">District Reseller</option>
            </select>
          </div>
        </div>

        {/* Clear Button */}
        {(searchQuery || selectedDistrict || selectedType) && (
          <button
            type="button"
            onClick={handleClear}
            className="w-full py-2 px-4 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200/50 hover:bg-orange-100/70 hover:border-orange-200 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>🧹</span> Clear Filters
          </button>
        )}
      </div>
    </div>
  );
}
