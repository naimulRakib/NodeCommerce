import React from "react";

interface StatsSummaryProps {
  summary: {
    totalSellers: number;
    totalLocalResellers: number;
    totalUpazillaResellers: number;
    totalDistrictResellers: number;
    totalNodes: number;
  };
}

export default function StatsSummary({ summary }: StatsSummaryProps) {
  const {
    totalSellers = 0,
    totalLocalResellers = 0,
    totalUpazillaResellers = 0,
    totalDistrictResellers = 0,
    totalNodes = 0,
  } = summary;

  return (
    <div className="flex flex-col gap-4">
      {/* 2x2 Grid for Reseller Types */}
      <div className="grid grid-cols-2 gap-4">
        
        {/* District Resellers */}
        <div className="bg-purple-50/80 border border-purple-200 hover:border-purple-300 rounded-2xl p-4 transition-all duration-300 hover:shadow-md flex flex-col gap-1 relative overflow-hidden group">
          <div className="absolute -right-3 -bottom-3 text-4xl opacity-15 select-none transition-transform duration-300 group-hover:scale-110">
            🏛️
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(124,58,237,0.5)]" />
            <span className="text-xs font-semibold text-purple-700 tracking-wide uppercase">
              Districts
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-extrabold text-purple-900 tracking-tight">
              {totalDistrictResellers}
            </span>
            <span className="text-xl">🏛️</span>
          </div>
          <span className="text-[11px] text-purple-600/80 font-medium">
            District Resellers
          </span>
        </div>

        {/* Upazilla Resellers */}
        <div className="bg-blue-50/80 border border-blue-200 hover:border-blue-300 rounded-2xl p-4 transition-all duration-300 hover:shadow-md flex flex-col gap-1 relative overflow-hidden group">
          <div className="absolute -right-3 -bottom-3 text-4xl opacity-15 select-none transition-transform duration-300 group-hover:scale-110">
            🏘️
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
            <span className="text-xs font-semibold text-blue-700 tracking-wide uppercase">
              Upazillas
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-extrabold text-blue-900 tracking-tight">
              {totalUpazillaResellers}
            </span>
            <span className="text-xl">🏘️</span>
          </div>
          <span className="text-[11px] text-blue-600/80 font-medium">
            Upazilla Resellers
          </span>
        </div>

        {/* Local Resellers */}
        <div className="bg-green-50/80 border border-green-200 hover:border-green-300 rounded-2xl p-4 transition-all duration-300 hover:shadow-md flex flex-col gap-1 relative overflow-hidden group">
          <div className="absolute -right-3 -bottom-3 text-4xl opacity-15 select-none transition-transform duration-300 group-hover:scale-110">
            🏪
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(5,150,105,0.5)]" />
            <span className="text-xs font-semibold text-green-700 tracking-wide uppercase">
              Locals
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-extrabold text-green-900 tracking-tight">
              {totalLocalResellers}
            </span>
            <span className="text-xl">🏪</span>
          </div>
          <span className="text-[11px] text-green-600/80 font-medium">
            Local Resellers
          </span>
        </div>

        {/* Sellers */}
        <div className="bg-amber-50/80 border border-amber-200 hover:border-amber-300 rounded-2xl p-4 transition-all duration-300 hover:shadow-md flex flex-col gap-1 relative overflow-hidden group">
          <div className="absolute -right-3 -bottom-3 text-4xl opacity-15 select-none transition-transform duration-300 group-hover:scale-110">
            🛍️
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(217,119,6,0.5)]" />
            <span className="text-xs font-semibold text-amber-700 tracking-wide uppercase">
              Sellers
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-extrabold text-amber-900 tracking-tight">
              {totalSellers}
            </span>
            <span className="text-xl">🛍️</span>
          </div>
          <span className="text-[11px] text-amber-600/80 font-medium">
            Sellers
          </span>
        </div>

      </div>

      {/* Wide Card for Totals */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700 hover:border-slate-600 rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all duration-300">
        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10 backdrop-blur-sm">
          <span className="text-xl animate-pulse">🇧🇩</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
            Supply Chain Map Summary
          </span>
          <h4 className="text-xl font-bold text-slate-100 flex items-baseline gap-2 mt-1">
            Total Active Nodes:{" "}
            <span className="text-2xl font-extrabold text-orange-500">
              {totalNodes}
            </span>
          </h4>
        </div>
      </div>
    </div>
  );
}
