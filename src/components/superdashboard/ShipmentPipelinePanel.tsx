"use client";

/**
 * ShipmentPipelinePanel — ENHANCED
 * - Bengali / English bilingual labels
 * - Phase color coding matching ACOFlowVisualizer
 * - Replaced all alert() with inline error state
 * - Better expand/collapse with animated chevron
 */
import React, { useEffect, useState } from "react";

interface LineItem {
  id: string;
  productName: string;
  allocatedQty: number;
  status: string;
}

interface Shipment {
  id: string;
  phase: 1 | 2 | 3 | 4;
  status: string;
  fromType: string;
  fromId: string;
  fromName: string;
  toType: string;
  toId: string;
  toName: string;
  totalQuantity: number;
  overallAcoScore: number;
  sourceApproved: boolean;
  targetApproved: boolean;
  expiresAt?: string;
  failureReason?: string | null;
  lineItems: LineItem[];
}

interface GlobalJob {
  id: string;
  status: string;
  triggerType: string;
  startedAt: string;
  finishedAt?: string | null;
  productScope: string[];
  shipments?: Shipment[];
  _count?: { shipments: number };
}

const PHASE_META = {
  1: { labelBn: "ধাপ ১", labelEn: "Phase 1 — Seller→Upazilla", color: "#10B981", bg: "bg-emerald-900/20 border-emerald-500/25" },
  2: { labelBn: "ধাপ ২", labelEn: "Phase 2 — Upazilla→District", color: "#3B82F6", bg: "bg-blue-900/20 border-blue-500/25" },
  3: { labelBn: "ধাপ ৩", labelEn: "Phase 3 — Surplus Routing", color: "#F59E0B", bg: "bg-amber-900/20 border-amber-500/25" },
  4: { labelBn: "ধাপ ৪", labelEn: "Phase 4 — Final Delivery", color: "#8B5CF6", bg: "bg-violet-900/20 border-violet-500/25" },
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending_approval: { label: "অনুমোদন বাকি", color: "text-amber-400" },
  approved:         { label: "অনুমোদিত",     color: "text-blue-400" },
  dispatched:       { label: "প্রেরিত",        color: "text-indigo-400" },
  delivered:        { label: "বিতরিত",        color: "text-emerald-400" },
  failed:           { label: "ব্যর্থ",          color: "text-red-400" },
};

export default function ShipmentPipelinePanel({ refreshKey }: { refreshKey?: number }) {
  const [jobs, setJobs] = useState<GlobalJob[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({});

  async function load() {
    try {
      const res = await fetch("/api/aco/global-jobs?includeShipments=1&limit=10");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (e) {
      console.error("[ShipmentPipelinePanel]", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [refreshKey]);

  async function approve(shipmentId: string, role: "source" | "target", decision: "approve" | "reject") {
    setBusyId(shipmentId);
    setInlineErrors(prev => ({ ...prev, [shipmentId]: "" }));
    try {
      const res = await fetch(`/api/aco/shipments/${shipmentId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "approval failed");
      await load();
    } catch (e: any) {
      setInlineErrors(prev => ({ ...prev, [shipmentId]: e.message }));
    } finally {
      setBusyId(null);
    }
  }

  async function triggerPhase4(shipmentId: string) {
    setBusyId(shipmentId);
    setInlineErrors(prev => ({ ...prev, [shipmentId]: "" }));
    try {
      const res = await fetch(`/api/aco/phase4-trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "phase4 failed");
      await load();
    } catch (e: any) {
      setInlineErrors(prev => ({ ...prev, [shipmentId]: e.message }));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
        <div className="w-3 h-3 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
        <span>শিপমেন্ট লোড হচ্ছে...</span>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-xs text-slate-600 italic py-1">
        কোনো ACO জব নেই। "ACO ফোরকাস্ট চালান" ক্লিক করুন।
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <span className="text-sm">📦</span>
        <div>
          <div className="font-bold text-sm text-slate-100">শিপমেন্ট পাইপলাইন</div>
          <div className="text-[10px] text-slate-500">Shipment Pipeline</div>
        </div>
      </div>

      {jobs.map((job) => {
        const isOpen = expanded === job.id;
        const shipCount = job._count?.shipments ?? job.shipments?.length ?? 0;
        const byPhase: Record<number, Shipment[]> = { 1: [], 2: [], 3: [], 4: [] };
        for (const s of job.shipments ?? []) byPhase[s.phase]?.push(s);

        const statusStyle =
          job.status === "completed" ? "bg-emerald-900/40 text-emerald-400 border-emerald-500/30" :
          job.status === "failed"    ? "bg-red-900/40 text-red-400 border-red-500/30" :
          "bg-amber-900/40 text-amber-400 border-amber-500/30";

        return (
          <div key={job.id} className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
            {/* Job header */}
            <button
              className="w-full flex justify-between items-center px-3 py-2.5 hover:bg-slate-800/60 transition-colors cursor-pointer"
              onClick={() => setExpanded(isOpen ? null : job.id)}
            >
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-300">#{job.id.slice(-8)}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${statusStyle}`}>
                    {job.status === "completed" ? "সম্পন্ন" : job.status === "failed" ? "ব্যর্থ" : "চলছে"}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {job.productScope.length} পণ্য · {shipCount} শিপমেন্ট
                </div>
              </div>
              <span className={`text-slate-400 transition-transform duration-200 text-xs ${isOpen ? "rotate-180" : ""}`}>▾</span>
            </button>

            {isOpen && job.shipments && (
              <div className="border-t border-slate-700/60 px-3 py-2 flex flex-col gap-2">
                {([1, 2, 3, 4] as const).map((phase) => {
                  const ships = byPhase[phase] || [];
                  if (ships.length === 0) return null;
                  const meta = PHASE_META[phase];
                  return (
                    <div key={phase}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                        <span className="text-[10px] font-bold text-slate-400">
                          {meta.labelBn} <span className="text-slate-600 font-normal">/ {meta.labelEn}</span>
                        </span>
                        <span className="text-[9px] text-slate-600 ml-1">({ships.length})</span>
                      </div>
                      <div className="flex flex-col gap-1.5 ml-3.5">
                        {ships.map((s) => {
                          const err = inlineErrors[s.id];
                          const isPending = s.status === "pending_approval";
                          const isApproved = s.status === "approved" || s.status === "dispatched";
                          const statusInfo = STATUS_MAP[s.status] || { label: s.status, color: "text-slate-400" };

                          return (
                            <div key={s.id} className={`rounded-lg border p-2 text-[10px] ${meta.bg}`}>
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="text-slate-400 truncate">{s.fromName}</span>
                                    <span className="text-slate-600">→</span>
                                    <span className="text-slate-200 font-semibold truncate">{s.toName}</span>
                                  </div>
                                  <div className="flex gap-2 mt-0.5">
                                    <span className="font-mono" style={{ color: meta.color }}>{s.totalQuantity}u</span>
                                    <span className="text-slate-600">·</span>
                                    <span className={statusInfo.color}>{statusInfo.label}</span>
                                  </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  {isPending && (
                                    <>
                                      <button disabled={!!busyId} onClick={() => approve(s.id, "source", "approve")}
                                        className="bg-emerald-700/60 hover:bg-emerald-700 disabled:opacity-50 text-white text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition">
                                        {busyId === s.id ? "..." : "✓"}
                                      </button>
                                      <button disabled={!!busyId} onClick={() => approve(s.id, "source", "reject")}
                                        className="bg-red-700/60 hover:bg-red-700 disabled:opacity-50 text-white text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition">
                                        ✗
                                      </button>
                                    </>
                                  )}
                                  {s.phase === 3 && isApproved && (
                                    <button disabled={!!busyId} onClick={() => triggerPhase4(s.id)}
                                      className="bg-violet-700/60 hover:bg-violet-700 disabled:opacity-50 text-white text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition">
                                      ▶ P4
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Inline error per shipment */}
                              {err && (
                                <div className="mt-1 text-red-400 text-[9px] bg-red-900/20 px-2 py-0.5 rounded">
                                  ⚠ {err}
                                </div>
                              )}

                              {/* Line items */}
                              {s.lineItems.length > 0 && (
                                <div className="mt-1 text-slate-600 truncate">
                                  {s.lineItems.map((li) => `${li.productName}×${li.allocatedQty}`).join(" · ")}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
