"use client";

import React from "react";

interface Job {
  id: string;
  productName: string;
  status: string;
  phase1Allocated: number;
  phase2Allocated: number;
  phase3Allocated: number;
  totalStock: number;
  completedAt?: string;
  sellerProduct?: {
    customName?: string;
    globalProduct?: { name: string };
  };
}

interface Opportunity {
  id: string;
  productName: string;
  quantity: number;
  acoScore: number;
  distanceKm: number;
  expiresAt: string;
  sourceDistrict: { district: string };
  targetDistrict: { district: string };
}

interface ACOPipelinePanelProps {
  jobs: Job[];
  pendingApprovals: Opportunity[];
  onApprovalAction: () => void;
  currentUserId?: string;
}

const STATUS_COLORS: Record<string, string> = {
  running: "#10B981",
  completed_pending_approval: "#F59E0B",
  completed: "#3B82F6",
  failed: "#EF4444",
};

function InlineError({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-2 bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-300">
      <span>⚠️</span>
      <span className="flex-1">{msg}</span>
      <button
        onClick={onDismiss}
        className="text-red-400 hover:text-red-200 cursor-pointer shrink-0"
      >
        ✕
      </button>
    </div>
  );
}

export default function ACOPipelinePanel({
  jobs,
  pendingApprovals,
  onApprovalAction,
}: ACOPipelinePanelProps) {
  const [loadingActionId, setLoadingActionId] = React.useState<string | null>(null);
  const [inlineError, setInlineError] = React.useState<string | null>(null);

  const activeJobs = jobs.filter(
    (j) => j.status === "running" || j.status === "completed_pending_approval"
  );
  const staleJobs = activeJobs.filter(
    (j) =>
      j.status === "running" &&
      new Date().getTime() - new Date(j.completedAt || Date.now()).getTime() > 24 * 60 * 60 * 1000
  );
  const recentCompletions = jobs.filter((j) => j.status === "completed").slice(0, 5);

  const handleApproveReject = async (oppId: string, action: "approve" | "reject") => {
    setLoadingActionId(oppId + action);
    setInlineError(null);
    try {
      const res = await fetch("/api/aco/approve-inter-district", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: oppId, action }),
      });
      if (res.ok) {
        onApprovalAction();
      } else {
        const data = await res.json();
        setInlineError(data.error || "Approval action failed. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setInlineError("Network error — could not process approval action.");
    } finally {
      setLoadingActionId(null);
    }
  };

  return (
    <div className="flex flex-col w-full gap-5 text-slate-200">

      {/* Inline error */}
      {inlineError && (
        <InlineError msg={inlineError} onDismiss={() => setInlineError(null)} />
      )}

      {/* ─── SECTION 1: ACTIVE JOBS ─── */}
      <div>
        <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-2 mb-3">
          <span>🐜</span>
          <span>সক্রিয় ACO কাজ</span>
          <span className="text-slate-600 font-normal text-xs">Active Jobs</span>
          {activeJobs.length > 0 && (
            <span className="ml-auto bg-emerald-900/50 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {activeJobs.length}
            </span>
          )}
        </h3>

        {activeJobs.length === 0 ? (
          <div className="text-xs text-slate-500 italic px-1">
            কোনো সক্রিয় কাজ নেই। / No active jobs.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {activeJobs.map((job) => {
              const name =
                job.productName ||
                job.sellerProduct?.globalProduct?.name ||
                job.sellerProduct?.customName ||
                "অজানা পণ্য";
              const total = job.totalStock || 1;
              const p1pct = Math.round((job.phase1Allocated / total) * 33);
              const p2pct = Math.round((job.phase2Allocated / total) * 33);
              const p3pct = Math.round((job.phase3Allocated / total) * 34);
              const statusColor = STATUS_COLORS[job.status] ?? "#64748B";

              return (
                <div
                  key={job.id}
                  className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 shadow-sm flex flex-col gap-2"
                  style={{ borderColor: `${statusColor}30` }}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span
                      className="text-xs font-semibold truncate"
                      title={name}
                      style={{ color: statusColor }}
                    >
                      {name}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500 shrink-0">
                      #{job.id.slice(-6)}
                    </span>
                  </div>

                  {/* Phase progress bar */}
                  <div className="w-full bg-slate-900 rounded-full h-1.5 flex overflow-hidden gap-0.5">
                    <div
                      className="bg-emerald-500 h-full rounded-l transition-all duration-700"
                      style={{ width: `${p1pct}%` }}
                    />
                    <div
                      className="bg-blue-500 h-full transition-all duration-700"
                      style={{ width: `${p2pct}%` }}
                    />
                    <div
                      className="bg-amber-500 h-full rounded-r transition-all duration-700"
                      style={{ width: `${p3pct}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px]">
                    <span
                      className="font-medium animate-pulse"
                      style={{ color: statusColor }}
                    >
                      {job.status === "running" ? "চলছে... / Running" : "অনুমোদনের অপেক্ষায়..."}
                    </span>
                    <span className="text-slate-400 font-mono">
                      P1:{job.phase1Allocated} P2:{job.phase2Allocated} P3:{job.phase3Allocated}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── SECTION 2: PENDING APPROVALS ─── */}
      {pendingApprovals.length > 0 && (
        <div>
          <h3 className="font-bold text-sm text-amber-400 flex items-center gap-2 border-b border-slate-800 pb-2 mb-3">
            <span>⚡</span>
            <span>অনুমোদন প্রয়োজন</span>
            <span className="text-slate-600 font-normal text-xs">Action Required</span>
            <span className="ml-auto bg-amber-900/50 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {pendingApprovals.length}
            </span>
          </h3>

          <div className="flex flex-col gap-3">
            {pendingApprovals.map((opp) => {
              const hoursLeft = Math.max(
                0,
                Math.floor(
                  (new Date(opp.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)
                )
              );
              return (
                <div
                  key={opp.id}
                  className="bg-slate-800/60 p-3 rounded-xl border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.08)] flex flex-col gap-2"
                >
                  <div className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                    <span>🏛</span> জেলা-আন্তঃ প্রস্তাব
                    <span className="text-[9px] font-normal text-slate-500 ml-1">Inter-District</span>
                  </div>
                  <div className="text-[10px] text-slate-300 flex flex-col gap-0.5">
                    <div>
                      <span className="text-slate-500">পণ্য: </span>
                      {opp.productName}
                    </div>
                    <div>
                      <span className="text-slate-500">পরিমাণ: </span>
                      {opp.quantity} ইউনিট
                    </div>
                    <div>
                      <span className="text-slate-500">পথ: </span>
                      {opp.sourceDistrict.district} → {opp.targetDistrict.district}
                    </div>
                    <div>
                      <span className="text-slate-500">স্কোর: </span>
                      {opp.acoScore.toFixed(2)} | {opp.distanceKm.toFixed(1)} কিমি
                    </div>
                    <div className={hoursLeft < 12 ? "text-red-400" : "text-amber-400"}>
                      মেয়াদ: {hoursLeft}ঘণ্টা বাকি
                    </div>
                  </div>

                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => handleApproveReject(opp.id, "approve")}
                      disabled={loadingActionId !== null}
                      className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/40 py-1.5 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {loadingActionId === opp.id + "approve" ? "..." : "✓ অনুমোদন"}
                    </button>
                    <button
                      onClick={() => handleApproveReject(opp.id, "reject")}
                      disabled={loadingActionId !== null}
                      className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/40 py-1.5 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {loadingActionId === opp.id + "reject" ? "..." : "✗ প্রত্যাখ্যান"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── SECTION 3: STALE JOBS ─── */}
      {staleJobs.length > 0 && (
        <div className="flex flex-col gap-2">
          {staleJobs.map((job) => (
            <div
              key={job.id}
              className="bg-red-900/15 border border-red-500/30 p-3 rounded-xl flex flex-col gap-1"
            >
              <span className="text-red-400 text-[10px] font-bold">
                ⚠ ACO কাজটি আটকে আছে — ম্যানুয়াল হস্তক্ষেপ প্রয়োজন
              </span>
              <span className="text-slate-400 text-[10px] font-mono">ID: {job.id}</span>
            </div>
          ))}
        </div>
      )}

      {pendingApprovals.length === 0 && staleJobs.length === 0 && (
        <div className="text-[10px] text-slate-600 italic px-1">
          কোনো অপেক্ষামাণ পদক্ষেপ নেই। / No pending actions.
        </div>
      )}

      {/* ─── SECTION 4: RECENT COMPLETIONS ─── */}
      {recentCompletions.length > 0 && (
        <div>
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-2 mb-3">
            <span>✅</span>
            <span>সম্পন্ন কাজ</span>
            <span className="text-slate-600 font-normal text-xs">Recent Completions</span>
          </h3>
          <div className="flex flex-col gap-1.5">
            {recentCompletions.map((job) => {
              const name =
                job.productName ||
                job.sellerProduct?.globalProduct?.name ||
                job.sellerProduct?.customName ||
                "অজানা";
              const isConserved = job.phase1Allocated + job.phase2Allocated + job.phase3Allocated <= job.totalStock;
              return (
                <div
                  key={job.id}
                  className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/40 flex flex-col gap-0.5 text-[10px]"
                >
                  <div className="font-semibold text-slate-300 truncate">{name}</div>
                  <div className="flex justify-between text-slate-500">
                    <span>P1:{job.phase1Allocated} P2:{job.phase2Allocated} P3:{job.phase3Allocated}</span>
                    <span className={isConserved ? "text-emerald-400" : "text-red-400"}>
                      {isConserved ? "✓ সংরক্ষিত" : "✗ মিলছে না"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
