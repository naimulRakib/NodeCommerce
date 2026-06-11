import React, { useState, useEffect, useCallback } from "react";
// @ts-ignore
import DISTRICT_CENTROIDS_RAW from "@/data/district-centroids.js";

const DISTRICT_CENTROIDS = DISTRICT_CENTROIDS_RAW as Record<string, { lat: number; lng: number }>;

const ALTERNATE_SPELLINGS = [
  "Chattogram", "Coxsbazar", "Coxs Bazar", "Bogura",
  "Jashore", "Barishal", "Narayangonj", "Munsiganj",
  "Jhalakathi", "Hobiganj",
];

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

  // Fix C4: stable ref to avoid infinite re-render
  const stableOnSearch = useCallback((q: string) => { onSearch(q); }, []); // eslint-disable-line

  useEffect(() => {
    const timer = setTimeout(() => {
      stableOnSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, stableOnSearch]);

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

  const hasFilter = !!(searchQuery || selectedDistrict || selectedType);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🔍</span>
          <div>
            <div className="font-bold text-sm text-slate-100">অনুসন্ধান</div>
            <div className="text-[10px] text-slate-500">Search & Filters</div>
          </div>
        </div>
        {hasFilter && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer transition-colors px-2 py-0.5 rounded border border-slate-700 hover:border-slate-500"
          >
            ↺ মুছুন
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="নাম, শহর, উপজেলা..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs bg-slate-800/60 border border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-600/50 text-slate-300 placeholder-slate-600 transition-all duration-200"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs select-none">🔍</span>
        </div>

        {/* District */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-bold text-slate-600 tracking-widest uppercase pl-1">
            জেলা / District
          </label>
          <select
            value={selectedDistrict}
            onChange={handleDistrictChange}
            className="w-full px-3 py-2 text-xs bg-slate-800/60 border border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-slate-300 transition-all duration-200"
          >
            <option value="">সব জেলা / All Districts</option>
            {DISTRICT_LIST.map((district) => (
              <option key={district} value={district}>{district}</option>
            ))}
          </select>
        </div>

        {/* Node Type */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-bold text-slate-600 tracking-widest uppercase pl-1">
            নোড ধরন / Node Type
          </label>
          <select
            value={selectedType}
            onChange={handleTypeChange}
            className="w-full px-3 py-2 text-xs bg-slate-800/60 border border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-slate-300 transition-all duration-200"
          >
            <option value="">সব ধরন / All Types</option>
            <option value="seller">🛍️ বিক্রেতা / Seller</option>
            <option value="local_reseller">🏪 স্থানীয় / Local</option>
            <option value="upazilla_reseller">🏘️ উপজেলা / Upazilla</option>
            <option value="district_reseller">🏛️ জেলা / District</option>
          </select>
        </div>
      </div>
    </div>
  );
}
