import React from "react";

interface NodeItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city?: string;
  upazilla?: string;
  district?: string;
  type: "seller" | "local_reseller" | "upazilla_reseller" | "district_reseller";
  createdAt?: string | Date;
}

interface NodeDetailPanelProps {
  node: NodeItem | null;
  onClose: () => void;
}

export default function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  // Format Member Since date
  const formatMemberDate = (dateVal?: string | Date) => {
    if (!dateVal) return "N/A";
    try {
      const d = new Date(dateVal);
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  const renderContent = () => {
    if (!node) return null;

    switch (node.type) {
      case "seller":
        return (
          <div className="flex flex-col gap-4">
            {/* Header Badge */}
            <div className="flex items-center gap-2">
              <span className="text-xl">🛍️</span>
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-full uppercase tracking-wider">
                Seller
              </span>
            </div>
            {/* Store details */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                Store Name
              </span>
              <h2 className="text-base font-extrabold text-slate-800 tracking-tight leading-tight">
                {node.name || "Unnamed Store"}
              </h2>
            </div>
            {/* Location */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                Location
              </span>
              <p className="text-xs font-semibold text-slate-605">
                {node.upazilla ? `${node.upazilla}, ` : ""}
                {node.city || "N/A"}
              </p>
            </div>
            {/* Coordinates */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                Coordinates
              </span>
              <p className="text-[11px] font-mono bg-slate-50 border border-slate-200/60 rounded-lg p-2 text-slate-650">
                Lat: {node.lat.toFixed(6)}
                <br />
                Lng: {node.lng.toFixed(6)}
              </p>
            </div>
          </div>
        );

      case "local_reseller":
        return (
          <div className="flex flex-col gap-4">
            {/* Header Badge */}
            <div className="flex items-center gap-2">
              <span className="text-xl">🏪</span>
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full uppercase tracking-wider">
                Local Reseller
              </span>
            </div>
            {/* Username */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                Username
              </span>
              <h2 className="text-base font-extrabold text-slate-800 tracking-tight leading-tight">
                {node.name || "Unnamed Reseller"}
              </h2>
            </div>
            {/* Location */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                Location
              </span>
              <p className="text-xs font-semibold text-slate-605">
                {node.upazilla ? `${node.upazilla}, ` : ""}
                {node.city || "N/A"}
              </p>
            </div>
            {/* Coordinates */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                Coordinates
              </span>
              <p className="text-[11px] font-mono bg-slate-50 border border-slate-200/60 rounded-lg p-2 text-slate-650">
                Lat: {node.lat.toFixed(6)}
                <br />
                Lng: {node.lng.toFixed(6)}
              </p>
            </div>
          </div>
        );

      case "upazilla_reseller":
        return (
          <div className="flex flex-col gap-4">
            {/* Header Badge */}
            <div className="flex items-center gap-2">
              <span className="text-xl">🏘️</span>
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-full uppercase tracking-wider">
                Upazilla Reseller
              </span>
            </div>
            {/* Email */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                Contact Email
              </span>
              <h2 className="text-sm font-bold text-slate-800 tracking-tight break-all">
                {node.name || "N/A"}
              </h2>
            </div>
            {/* Location */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                Territory
              </span>
              <p className="text-xs font-semibold text-slate-605">
                {node.upazilla || "N/A"}
                {node.city ? `, ${node.city}` : ""}
              </p>
            </div>
            {/* Note */}
            <div className="bg-blue-50/50 border border-blue-200/30 rounded-xl p-2.5 flex gap-2">
              <span className="text-sm">📍</span>
              <p className="text-[10px] text-blue-700/80 leading-relaxed font-medium">
                Location is approximate (upazilla centroid)
              </p>
            </div>
          </div>
        );

      case "district_reseller":
        return (
          <div className="flex flex-col gap-4">
            {/* Header Badge */}
            <div className="flex items-center gap-2">
              <span className="text-xl">🏛️</span>
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded-full uppercase tracking-wider">
                District Reseller
              </span>
            </div>
            {/* Email */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                Contact Email
              </span>
              <h2 className="text-sm font-bold text-slate-800 tracking-tight break-all">
                {node.name || "N/A"}
              </h2>
            </div>
            {/* Location */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                Territory
              </span>
              <p className="text-xs font-semibold text-slate-605">
                {node.district || "N/A"} District
              </p>
            </div>
            {/* Note */}
            <div className="bg-purple-50/50 border border-purple-200/30 rounded-xl p-2.5 flex gap-2">
              <span className="text-sm">📍</span>
              <p className="text-[10px] text-purple-700/80 leading-relaxed font-medium">
                Location is approximate (district centroid)
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`
        fixed inset-x-0 bottom-0 z-50 h-[50vh] w-full bg-white border-t border-slate-200 shadow-2xl
        flex flex-col justify-between transition-transform duration-300 ease-in-out
        ${node ? "translate-y-0" : "translate-y-full"}
        
        md:relative md:inset-y-auto md:right-auto md:bottom-auto md:h-full md:w-[320px] md:border-t-0 md:border-l md:shadow-none
        ${node ? "md:flex md:translate-y-0" : "md:hidden md:translate-y-0"}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 shrink-0">
        <h3 className="font-bold text-slate-800 text-xs tracking-wide uppercase">
          Node Details
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors duration-205 cursor-pointer"
        >
          <span className="text-sm font-bold">✕</span>
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
        {node ? (
          renderContent()
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs">
            Select a node to inspect details
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 text-[10px] text-slate-450 flex items-center justify-between shrink-0">
        <span>ID: {node?.id ? `${node.id.substring(0, 8)}...` : "N/A"}</span>
        <span className="font-semibold text-slate-500">
          Since: {node ? formatMemberDate(node.createdAt) : "N/A"}
        </span>
      </div>
    </div>
  );
}
