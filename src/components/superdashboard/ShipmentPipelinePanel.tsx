"use client";

/**
 * ShipmentPipelinePanel
 * ---------------------
 * Polls /api/aco/global-jobs?includeShipments=1 and renders
 * a vertical timeline of every Phase 1 → 4 shipment.
 *
 * For Phase 3 shipments in `pending_approval`, shows
 * approve / reject buttons IF the current operator is the
 * head of the source or target district. (The check is
 * server-side; we just render the button.)
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

interface ShipmentPipelinePanelProps {
  refreshKey?: number;
}

export default function ShipmentPipelinePanel({ refreshKey }: ShipmentPipelinePanelProps) {
  const [jobs, setJobs] = useState<GlobalJob[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/aco/global-jobs?includeShipments=1&limit=10");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (e) {
      console.error(e);
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
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function triggerPhase4(shipmentId: string) {
    setBusyId(shipmentId);
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
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="text-xs text-slate-500 italic">Loading shipments…</div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-xs text-slate-500 italic">
        No global ACO jobs yet. Trigger one with the Global ACO button.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {jobs.map((job) => {
        const isOpen = expanded === job.id;
        const shipCount = job._count?.shipments ?? job.shipments?.length ?? 0;
        const byPhase: Record<number, Shipment[]> = { 1: [], 2: [], 3: [], 4: [] };
        for (const s of job.shipments ?? []) byPhase[s.phase]?.push(s);
        return (
          <div
            key={job.id}
            className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-xs"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="text-slate-200 font-bold">
                  Job {job.id.slice(0, 8)}{" "}
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ml-1 ${
                      job.status === "completed"
                        ? "bg-emerald-700"
                        : job.status === "failed"
                        ? "bg-red-700"
                        : "bg-amber-700"
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
                <div className="text-slate-500">
                  {job.productScope.length} products · {shipCount} shipments · {new Date(job.startedAt).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => setExpanded(isOpen ? null : job.id)}
                className="text-slate-400 hover:text-white px-2"
              >
                {isOpen ? "▾" : "▸"}
              </button>
            </div>

            {isOpen && job.shipments && (
              <div className="mt-2 flex flex-col gap-2">
                {[1, 2, 3, 4].map((phase) => {
                  const ships = byPhase[phase] || [];
                  if (ships.length === 0) return null;
                  return (
                    <div key={phase}>
                      <div className="text-slate-400 font-bold mb-1">
                        Phase {phase} ({ships.length})
                      </div>
                      <div className="flex flex-col gap-1">
                        {ships.map((s) => (
                          <ShipmentRow
                            key={s.id}
                            s={s}
                            busy={busyId === s.id}
                            onApprove={approve}
                            onTriggerP4={triggerPhase4}
                          />
                        ))}
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

function ShipmentRow({
  s,
  busy,
  onApprove,
  onTriggerP4,
}: {
  s: Shipment;
  busy: boolean;
  onApprove: (id: string, role: "source" | "target", decision: "approve" | "reject") => void;
  onTriggerP4: (id: string) => void;
}) {
  const isPending = s.status === "pending_approval";
  const isApproved = s.status === "approved" || s.status === "dispatched";
  return (
    <div className="bg-slate-900/60 border border-slate-700/50 rounded p-2">
      <div className="flex justify-between items-center">
        <div className="text-slate-200">
          <span className="text-slate-400">{s.fromName}</span> →{" "}
          <span className="text-slate-200">{s.toName}</span>{" "}
          <span className="text-amber-400">({s.totalQuantity}u)</span>
        </div>
        <div className="flex gap-1 items-center">
          <span className="text-[10px] text-slate-500">
            score {s.overallAcoScore.toFixed(2)}
          </span>
          {isPending && (
            <>
              <button
                disabled={busy}
                onClick={() => onApprove(s.id, "source", "approve")}
                className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-[10px] px-1.5 py-0.5 rounded"
              >
                ✓ src
              </button>
              <button
                disabled={busy}
                onClick={() => onApprove(s.id, "target", "approve")}
                className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-[10px] px-1.5 py-0.5 rounded"
              >
                ✓ tgt
              </button>
              <button
                disabled={busy}
                onClick={() => onApprove(s.id, "source", "reject")}
                className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-[10px] px-1.5 py-0.5 rounded"
              >
                ✗
              </button>
            </>
          )}
          {s.phase === 3 && isApproved && (
            <button
              disabled={busy}
              onClick={() => onTriggerP4(s.id)}
              className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-[10px] px-1.5 py-0.5 rounded"
            >
              ▶ P4
            </button>
          )}
        </div>
      </div>
      <div className="text-[10px] text-slate-500 mt-1 truncate">
        {s.lineItems.map((li) => `${li.productName}×${li.allocatedQty}`).join(" · ")}
      </div>
    </div>
  );
}
