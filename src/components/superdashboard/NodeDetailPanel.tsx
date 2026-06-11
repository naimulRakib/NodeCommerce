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

const TYPE_META = {
  seller: {
    icon: "🛍️",
    badge: "বিক্রেতা / Seller",
    badgeColor: "bg-amber-900/30 text-amber-400 border-amber-500/30",
    accentColor: "#F59E0B",
  },
  local_reseller: {
    icon: "🏪",
    badge: "স্থানীয় রিসেলার / Local",
    badgeColor: "bg-emerald-900/30 text-emerald-400 border-emerald-500/30",
    accentColor: "#10B981",
  },
  upazilla_reseller: {
    icon: "🏘️",
    badge: "উপজেলা রিসেলার / Upazilla",
    badgeColor: "bg-blue-900/30 text-blue-400 border-blue-500/30",
    accentColor: "#3B82F6",
  },
  district_reseller: {
    icon: "🏛️",
    badge: "জেলা রিসেলার / District",
    badgeColor: "bg-purple-900/30 text-purple-400 border-purple-500/30",
    accentColor: "#8B5CF6",
  },
};

function InfoRow({ label, labelEn, value }: { label: string; labelEn?: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-bold text-slate-600 tracking-widest uppercase">
        {label}{labelEn ? ` / ${labelEn}` : ""}
      </span>
      <p className="text-sm font-semibold text-slate-200 break-words">{value || "N/A"}</p>
    </div>
  );
}

export default function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  const formatMemberDate = (dateVal?: string | Date) => {
    if (!dateVal) return "N/A";
    try {
      return new Date(dateVal).toLocaleDateString("bn-BD", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  const meta = node ? TYPE_META[node.type] : null;

  const renderContent = () => {
    if (!node || !meta) return null;

    return (
      <div className="flex flex-col gap-4">
        {/* Type badge */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">{meta.icon}</span>
          <span className={`px-2.5 py-0.5 text-[10px] font-bold border rounded-full ${meta.badgeColor}`}>
            {meta.badge}
          </span>
        </div>

        {/* Name */}
        <InfoRow
          label="নাম"
          labelEn={node.type === "seller" ? "Store Name" : "Username"}
          value={node.name || "অজানা"}
        />

        {/* Location */}
        {(node.upazilla || node.city || node.district) && (
          <InfoRow
            label="এলাকা"
            labelEn="Location"
            value={[node.upazilla, node.city, node.district].filter(Boolean).join(", ")}
          />
        )}

        {/* Coordinates */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-bold text-slate-600 tracking-widest uppercase">
            স্থানাঙ্ক / Coordinates
          </span>
          <p className="text-[11px] font-mono bg-slate-800/50 border border-slate-700/60 rounded-lg p-2 text-slate-400">
            Lat: {node.lat.toFixed(6)}<br />
            Lng: {node.lng.toFixed(6)}
          </p>
        </div>

        {/* Supply chain note for non-sellers */}
        {(node.type === "upazilla_reseller" || node.type === "district_reseller") && (
          <div
            className="rounded-xl p-2.5 flex gap-2 text-[10px] border"
            style={{
              background: `${meta.accentColor}10`,
              borderColor: `${meta.accentColor}30`,
              color: meta.accentColor,
            }}
          >
            <span>📍</span>
            <span>অবস্থান আনুমানিক ({node.type === "upazilla_reseller" ? "উপজেলা কেন্দ্র" : "জেলা কেন্দ্র"})</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`
        fixed inset-x-0 bottom-0 z-50 h-[50vh] w-full bg-slate-900 border-t border-slate-800 shadow-2xl
        flex flex-col justify-between transition-transform duration-300 ease-in-out
        ${node ? "translate-y-0" : "translate-y-full"}
        
        md:relative md:inset-y-auto md:right-auto md:bottom-auto md:h-full md:w-[300px] md:border-t-0 md:border-l md:shadow-none
        ${node ? "md:flex md:translate-y-0" : "md:hidden md:translate-y-0"}
      `}
      style={node ? { borderLeftColor: `${meta?.accentColor}30` } : {}}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/80 shrink-0">
        <h3 className="font-bold text-slate-300 text-xs tracking-wide uppercase flex items-center gap-1.5">
          {meta?.icon} নোড বিবরণ
          <span className="text-slate-600 font-normal">/ Node Details</span>
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
        >
          <span className="text-sm font-bold">✕</span>
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
        {node ? (
          renderContent()
        ) : (
          <div className="h-full flex items-center justify-center text-slate-600 text-xs">
            ম্যাপে একটি নোড নির্বাচন করুন / Select a node on the map
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/60 text-[10px] text-slate-600 flex items-center justify-between shrink-0">
        <span className="font-mono">ID: {node?.id ? `${node.id.slice(0, 8)}...` : "—"}</span>
        <span>{node ? formatMemberDate(node.createdAt) : "—"}</span>
      </div>
    </div>
  );
}
