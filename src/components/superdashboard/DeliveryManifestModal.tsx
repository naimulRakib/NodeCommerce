"use client";

/**
 * DeliveryManifestModal
 * =====================
 * Shown when a truck arrives at a destination during the ACO demo.
 * Simulates UiPath agent generating a delivery manifest PDF.
 *
 * Flow:
 * 1. "UiPath এজেন্ট PDF তৈরি করছে..." loading state (1.5s)
 * 2. PDF preview button appears → opens manifest in new tab
 * 3. "✅ গুদাম গ্রহণ নিশ্চিত করুন" button → calls onConfirm
 *    (triggers Phase 2 if surplus)
 */

import React, { useEffect, useState } from "react";
import type { TruckRoute } from "./ACOTruckLayer";

interface Props {
  route: TruckRoute;
  onConfirm: () => void;
  onClose: () => void;
}

type ManifestState = "generating" | "ready";

const PHASE_META: Record<number, { title: string; icon: string; color: string; subtitle: string }> = {
  1: {
    title: "ধাপ ১: উপজেলা হাব বিতরণ",
    icon: "🏘️",
    color: "#F59E0B",
    subtitle: "Phase 1 — Seller → Upazilla Hub",
  },
  2: {
    title: "ধাপ ২: জেলা হাব বিতরণ",
    icon: "🏛️",
    color: "#3B82F6",
    subtitle: "Phase 2 — Upazilla Hub → District Hub",
  },
  3: {
    title: "ধাপ ৩: আন্তঃজেলা স্থানান্তর",
    icon: "🌐",
    color: "#8B5CF6",
    subtitle: "Phase 3 — Inter-District Transfer",
  },
  4: {
    title: "ধাপ ৪: চূড়ান্ত বিতরণ",
    icon: "✅",
    color: "#14B8A6",
    subtitle: "Phase 4 — District Hub → Final Destination",
  },
};

export default function DeliveryManifestModal({ route, onConfirm, onClose }: Props) {
  const [state, setState] = useState<ManifestState>("generating");
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const meta = PHASE_META[route.phase] ?? PHASE_META[1];
  const isLastPhase = route.phase >= 2; // After phase 2, it's "complete"

  useEffect(() => {
    // Simulate UiPath generating the PDF manifest (1.5s)
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/uipath/delivery-manifest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shipmentId: route.id,
            phase: route.phase,
            fromName: route.fromName,
            toName: route.toName,
            totalQuantity: route.totalQuantity,
            products: route.products ?? [],
            type: "arrival",
          }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          setManifestUrl(url);
        }
      } catch (err) {
        console.warn("[DeliveryManifestModal] PDF fetch failed:", err);
      }
      setState("ready");
    }, 1500);

    return () => {
      clearTimeout(t);
      if (manifestUrl) URL.revokeObjectURL(manifestUrl);
    };
  }, [route.id]);

  const handleConfirm = () => {
    setConfirming(true);
    setTimeout(() => {
      onConfirm();
      onClose();
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
      {/* Modal card */}
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300"
        style={{ background: "#0f172a", border: `1px solid ${meta.color}40` }}
      >
        {/* Header bar */}
        <div
          className="px-5 py-4 flex items-center gap-3"
          style={{ background: `${meta.color}15`, borderBottom: `1px solid ${meta.color}30` }}
        >
          <span className="text-2xl">{meta.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-white truncate">{meta.title}</div>
            <div className="text-xs text-slate-400 truncate">{meta.subtitle}</div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-xl leading-none cursor-pointer transition-colors"
          >×</button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {/* Route info */}
          <div className="flex items-center gap-2 bg-slate-800/60 rounded-xl p-3">
            <div className="flex-1 text-xs">
              <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-0.5">প্রেরক / From</div>
              <div className="text-white font-semibold truncate">{route.fromName}</div>
            </div>
            <div className="text-lg">🚛</div>
            <div className="flex-1 text-xs text-right">
              <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-0.5">প্রাপক / To</div>
              <div className="text-white font-semibold truncate">{route.toName}</div>
            </div>
          </div>

          {/* Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/60 rounded-xl p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">মোট পণ্য</div>
              <div className="text-2xl font-bold" style={{ color: meta.color }}>{route.totalQuantity}</div>
              <div className="text-[10px] text-slate-500">ইউনিট / units</div>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">পণ্যের ধরন</div>
              <div className="text-2xl font-bold text-white">{Math.max(1, route.products?.length ?? 1)}</div>
              <div className="text-[10px] text-slate-500">ধরন / types</div>
            </div>
          </div>

          {/* Product list */}
          {route.products && route.products.length > 0 && (
            <div className="bg-slate-800/40 rounded-xl p-3 flex flex-col gap-1.5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">📦 পণ্য তালিকা</div>
              {route.products.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 truncate flex-1 mr-2">{p.name}</span>
                  <span className="font-bold text-white font-mono">{p.qty ?? p.quantity ?? 0}</span>
                </div>
              ))}
            </div>
          )}

          {/* UiPath PDF section */}
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: "#1e1b4b", border: "1px solid #4c1d9530" }}
          >
            {state === "generating" ? (
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 flex-shrink-0">
                  {/* Spinning ring */}
                  <svg className="animate-spin" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="13" stroke="#4f46e530" strokeWidth="3" />
                    <path d="M16 3 a13 13 0 0 1 13 13" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs">🤖</span>
                </div>
                <div>
                  <div className="text-sm font-bold text-indigo-300">UiPath এজেন্ট চলছে...</div>
                  <div className="text-[11px] text-slate-400">ডেলিভারি মেনিফেস্ট তৈরি হচ্ছে</div>
                  <div className="text-[10px] text-slate-500">Generating delivery manifest PDF...</div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <div>
                    <div className="text-sm font-bold text-indigo-300">UiPath PDF তৈরি সম্পন্ন!</div>
                    <div className="text-[10px] text-slate-400">Delivery manifest generated successfully</div>
                  </div>
                  <span className="ml-auto text-emerald-400 text-lg">✅</span>
                </div>
                {manifestUrl && (
                  <a
                    href={manifestUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                    style={{ background: "#4f46e5", color: "#fff" }}
                  >
                    📄 মেনিফেস্ট দেখুন / View PDF
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Confirm receipt button */}
          <button
            onClick={handleConfirm}
            disabled={state === "generating" || confirming}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            style={{
              background: state === "ready" && !confirming
                ? `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`
                : "#374151",
              color: "#fff",
              boxShadow: state === "ready" ? `0 4px 20px ${meta.color}40` : "none",
            }}
          >
            {confirming ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span> গ্রহণ নিশ্চিত হচ্ছে...
              </span>
            ) : state === "generating" ? (
              "PDF তৈরির জন্য অপেক্ষা করুন..."
            ) : (
              <span className="flex items-center justify-center gap-2">
                ✅
                <span>
                  <span className="block">গুদাম গ্রহণ নিশ্চিত করুন</span>
                  <span className="text-[10px] font-normal opacity-80">
                    {isLastPhase ? "Confirm receipt & complete" : "Confirm receipt & send surplus →"}
                  </span>
                </span>
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
