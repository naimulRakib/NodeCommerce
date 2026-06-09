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

export default function LayerControls({
  visibleLayers,
  onToggle,
  counts = { seller: 0, local_reseller: 0, upazilla_reseller: 0, district_reseller: 0 },
}: LayerControlsProps) {
  
  const layersConfig = [
    {
      key: "district_reseller" as const,
      label: "District Resellers",
      colorClass: "bg-purple-500 shadow-[0_0_8px_rgba(124,58,237,0.5)] border border-purple-600",
      activeBg: "peer-checked:bg-purple-600 peer-focus:ring-purple-300",
      count: counts.district_reseller,
    },
    {
      key: "upazilla_reseller" as const,
      label: "Upazilla Resellers",
      colorClass: "bg-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.5)] border border-blue-600",
      activeBg: "peer-checked:bg-blue-600 peer-focus:ring-blue-300",
      count: counts.upazilla_reseller,
    },
    {
      key: "local_reseller" as const,
      label: "Local Resellers",
      colorClass: "bg-emerald-500 shadow-[0_0_8px_rgba(5,150,105,0.5)] border border-emerald-600",
      activeBg: "peer-checked:bg-emerald-600 peer-focus:ring-emerald-300",
      count: counts.local_reseller,
    },
    {
      key: "seller" as const,
      label: "Sellers",
      colorClass: "bg-amber-500 shadow-[0_0_8px_rgba(217,119,6,0.5)] border border-amber-600",
      activeBg: "peer-checked:bg-amber-600 peer-focus:ring-amber-300",
      count: counts.seller,
    },
    {
      key: "pheromone" as const,
      label: "🐜 Pheromone Trails",
      colorClass: "bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.5)] border border-rose-600",
      activeBg: "peer-checked:bg-rose-600 peer-focus:ring-rose-300",
      count: "-",
    },
    {
      key: "trucks" as const,
      label: "🚛 Active Trucks",
      colorClass: "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] border border-indigo-600",
      activeBg: "peer-checked:bg-indigo-600 peer-focus:ring-indigo-300",
      count: "-",
    },
  ];

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
        <span className="text-xl">🗺️</span>
        <h3 className="font-bold text-slate-800 tracking-tight text-base">
          Map Layers
        </h3>
      </div>

      <div className="flex flex-col gap-4">
        {layersConfig.map((layer) => {
          const isChecked = visibleLayers[layer.key];

          return (
            <div
              key={layer.key}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors duration-200"
            >
              {/* Dot + Label */}
              <div className="flex items-center gap-3">
                <span className={`w-3.5 h-3.5 rounded-full ${layer.colorClass}`} />
                <span className="text-sm font-semibold text-slate-700">
                  {layer.label}
                </span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                  {layer.count}
                </span>
              </div>

              {/* Custom Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggle(layer.key)}
                  className="sr-only peer"
                />
                <div
                  className={`w-11 h-6 bg-slate-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 transition-colors duration-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all duration-200 peer-checked:after:translate-x-full ${layer.activeBg}`}
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
