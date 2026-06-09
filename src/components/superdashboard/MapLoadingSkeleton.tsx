import React from "react";

export default function MapLoadingSkeleton() {
  return (
    <div className="relative w-full h-[600px] md:h-[700px] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center justify-center border border-slate-800">
      {/* Background Animated Pulse */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 animate-pulse opacity-60" />

      {/* Foreground Indicator */}
      <div className="relative z-10 flex flex-col items-center gap-4 text-center px-4">
        <div className="relative flex items-center justify-center">
          {/* Animated rings */}
          <div className="absolute w-24 h-24 rounded-full border border-orange-500/30 animate-ping duration-1000" />
          <div className="absolute w-16 h-16 rounded-full border-2 border-dashed border-orange-500/50 animate-spin" />
          
          <div className="w-12 h-12 rounded-full bg-slate-850 flex items-center justify-center shadow-lg border border-slate-700">
            <span className="text-2xl animate-bounce" role="img" aria-label="Map Pin">
              📍
            </span>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2 justify-center">
            Loading Map <span className="animate-pulse">🇧🇩</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
            Initializing geographic reference data...
          </p>
        </div>
      </div>
    </div>
  );
}
