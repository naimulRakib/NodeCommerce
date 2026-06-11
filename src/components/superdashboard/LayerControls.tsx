import React from "react";

interface LayerControlsProps {
  visibleLayers: {
    seller: boolean;
    local_reseller: boolean;
    upazilla_reseller: boolean;
    district_reseller: boolean;
    pheromone: boolean;
    trucks: boolean;
  };
  onToggle: (layerKey: keyof LayerControlsProps["visibleLayers"]) => void;
  counts?: {
    seller: number;
    local_reseller: number;
    upazilla_reseller: number;
    district_reseller: number;
  };
}

const LAYERS = [
  {
    key: "district_reseller" as const,
    icon: "🏛️",
    labelBn: "জেলা রিসেলার",
    labelEn: "District",
    dotClass: "bg-purple-500 shadow-[0_0_6px_rgba(139,92,246,0.7)]",
    ringColor: "#8B5CF6",
  },
  {
    key: "upazilla_reseller" as const,
    icon: "🏘️",
    labelBn: "উপজেলা রিসেলার",
    labelEn: "Upazilla",
    dotClass: "bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.7)]",
    ringColor: "#3B82F6",
  },
  {
    key: "local_reseller" as const,
    icon: "🏪",
    labelBn: "স্থানীয় রিসেলার",
    labelEn: "Local",
    dotClass: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]",
    ringColor: "#10B981",
  },
  {
    key: "seller" as const,
    icon: "🛍️",
    labelBn: "বিক্রেতা",
    labelEn: "Seller",
    dotClass: "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.7)]",
    ringColor: "#F59E0B",
  },
  {
    key: "pheromone" as const,
    icon: "🐜",
    labelBn: "ফেরোমন ট্রেইল",
    labelEn: "Pheromone",
    dotClass: "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)]",
    ringColor: "#F43F5E",
  },
  {
    key: "trucks" as const,
    icon: "🚛",
    labelBn: "সক্রিয় ট্রাক",
    labelEn: "Trucks",
    dotClass: "bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.7)]",
    ringColor: "#6366F1",
  },
];

export default function LayerControls({
  visibleLayers,
  onToggle,
  counts = { seller: 0, local_reseller: 0, upazilla_reseller: 0, district_reseller: 0 },
}: LayerControlsProps) {
  const getCount = (key: string): string => {
    if (key === "seller")             return String(counts.seller);
    if (key === "local_reseller")     return String(counts.local_reseller);
    if (key === "upazilla_reseller")  return String(counts.upazilla_reseller);
    if (key === "district_reseller")  return String(counts.district_reseller);
    return "—";
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <span className="text-base">🗺️</span>
        <div>
          <div className="font-bold text-sm text-slate-100">ম্যাপ লেয়ার</div>
          <div className="text-[10px] text-slate-500">Map Layers</div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {LAYERS.map((layer) => {
          const checked = visibleLayers[layer.key];
          const count = getCount(layer.key);

          return (
            <div
              key={layer.key}
              className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer ${
                checked ? "bg-slate-800/80" : "bg-slate-900/40 opacity-60"
              }`}
              onClick={() => onToggle(layer.key)}
            >
              {/* Dot + labels */}
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-3 h-3 rounded-full shrink-0 transition-all ${
                    checked ? layer.dotClass : "bg-slate-700"
                  }`}
                />
                <div>
                  <div className={`text-xs font-semibold ${checked ? "text-slate-200" : "text-slate-500"}`}>
                    {layer.labelBn}
                  </div>
                  <div className="text-[9px] text-slate-600">{layer.labelEn}</div>
                </div>
                {count !== "—" && (
                  <span className="text-[9px] font-mono bg-slate-800 text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded-full">
                    {count}
                  </span>
                )}
              </div>

              {/* Toggle */}
              <div
                className={`relative w-9 h-5 rounded-full transition-all duration-200 shrink-0 ${
                  checked ? "bg-emerald-600" : "bg-slate-700"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                    checked ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
