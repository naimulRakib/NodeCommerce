"use client";

import React from "react";

interface Allocation {
  id: string;
  phase: number;
  toId: string;
  fromId: string;
  quantity: number;
  status: string;
  acoScore?: number;
}

interface InterDistrictOpportunity {
  id: string;
  sourceDistrict: { district: string };
  targetDistrict: { district: string };
  quantity: number;
  status: string;
  acoScore: number;
}

interface ACORoutingJob {
  id: string;
  status: string;
  totalStock: number;
  phase1Allocated: number;
  phase2Allocated: number;
  phase3Allocated: number;
  sellerProduct?: {
    customName?: string;
    globalProduct?: { name: string };
    seller: { storeName: string; upazilla: string; city: string };
  };
  allocations?: Allocation[];
  interDistrict?: InterDistrictOpportunity[];
}

export default function ACOPipelineVisualization({ job }: { job: ACORoutingJob }) {
  if (!job || !job.sellerProduct) return null;

  const seller = job.sellerProduct.seller;
  const phase1 = job.allocations?.filter(a => a.phase === 1) || [];
  const allPhase2 = job.allocations?.filter(a => a.phase === 2) || [];
  const allInterDistrict = job.interDistrict || [];

  // Edge Case 54: Cap nodes to prevent SVG explosion
  const MAX_NODES = 5;
  const phase2 = allPhase2.slice(0, MAX_NODES);
  const interDistrict = allInterDistrict.slice(0, MAX_NODES);
  
  const phase2Hidden = Math.max(0, allPhase2.length - MAX_NODES);
  const phase3Hidden = Math.max(0, allInterDistrict.length - MAX_NODES);

  const totalAllocated = job.phase1Allocated + job.phase2Allocated + job.phase3Allocated;
  const isConserved = totalAllocated <= job.totalStock;

  const getStatusColor = (status: string) => {
    switch(status) {
      case "executed": return "#10B981"; // emerald-500
      case "pending_approval": return "#F59E0B"; // amber-500
      case "source_rejected":
      case "target_rejected":
      case "rejected": return "#EF4444"; // red-500
      case "failed":
      case "failed_insufficient": return "#F97316"; // orange-500
      default: return "#94A3B8"; // slate-400
    }
  };

  const svgWidth = 900;
  // Calculate height dynamically based on the max number of nodes in phase 2 or 3
  const maxNodes = Math.max(1, phase2.length, interDistrict.length);
  const svgHeight = Math.max(300, maxNodes * 80 + 100);
  const centerY = svgHeight / 2;

  // Node positions
  const xSeller = 80;
  const xPhase1 = 260;
  const xPhase2 = 460;
  const xPhase3 = 660;
  const xConservation = 820;

  return (
    <div className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 overflow-x-auto text-slate-200 flex justify-center">
      <svg width={svgWidth} height={svgHeight} className="font-sans">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#64748B" />
          </marker>
          <marker id="arrowhead-green" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#10B981" />
          </marker>
        </defs>

        {/* --- LINKS --- */}
        {/* Seller to Phase 1 */}
        <line x1={xSeller + 40} y1={centerY} x2={xPhase1 - 40} y2={centerY} stroke="#64748B" strokeWidth="2" strokeDasharray="4 4" markerEnd="url(#arrowhead)" />
        
        {/* Phase 1 to Phase 2 (Fan out) */}
        {phase2.map((p2, i) => {
          const yP2 = centerY - ((phase2.length - 1) * 40) + (i * 80);
          const thickness = Math.max(1, Math.min(6, p2.quantity / 10)); // Proportional to qty
          return (
            <line key={`link-p2-${p2.id}`} x1={xPhase1 + 40} y1={centerY} x2={xPhase2 - 50} y2={yP2} stroke="#64748B" strokeWidth={thickness} markerEnd="url(#arrowhead)" />
          );
        })}

        {/* Phase 2 to Phase 3 (Fan out from center line for simplicity, visually representing pipeline) */}
        {interDistrict.map((p3, i) => {
          const yP3 = centerY - ((interDistrict.length - 1) * 40) + (i * 80);
          const thickness = Math.max(1, Math.min(6, p3.quantity / 10));
          return (
            <line key={`link-p3-${p3.id}`} x1={xPhase2 + 50} y1={centerY} x2={xPhase3 - 50} y2={yP3} stroke="#64748B" strokeWidth={thickness} markerEnd="url(#arrowhead)" />
          );
        })}

        {/* --- NODES --- */}

        {/* Seller Node */}
        <g transform={`translate(${xSeller}, ${centerY})`}>
          <circle r="40" fill="#1E293B" stroke="#64748B" strokeWidth="2" />
          <text x="0" y="-10" textAnchor="middle" fill="#F8FAFC" fontSize="12" fontWeight="bold">{seller.storeName.length > 12 ? seller.storeName.slice(0, 10) + '...' : seller.storeName}</text>
          <text x="0" y="5" textAnchor="middle" fill="#94A3B8" fontSize="10">{seller.upazilla}</text>
          <text x="0" y="20" textAnchor="middle" fill="#C084FC" fontSize="10" fontWeight="bold">{job.totalStock} units</text>
        </g>

        {/* Phase 1 Node */}
        <text x={xPhase1} y="30" textAnchor="middle" fill="#94A3B8" fontSize="12" fontWeight="bold" letterSpacing="1">PHASE 1</text>
        <g transform={`translate(${xPhase1}, ${centerY})`}>
          {phase1.length > 0 ? (
            <>
              <circle r="35" fill={`${getStatusColor(phase1[0].status)}33`} stroke={getStatusColor(phase1[0].status)} strokeWidth="2" />
              <text x="0" y="-5" textAnchor="middle" fill="#F8FAFC" fontSize="11" fontWeight="bold">{seller.upazilla.length > 10 ? seller.upazilla.slice(0, 8) + '...' : seller.upazilla}</text>
              <text x="0" y="10" textAnchor="middle" fill="#10B981" fontSize="10" fontWeight="bold">{job.phase1Allocated} qty</text>
            </>
          ) : (
            <>
              <circle r="30" fill="#1E293B" stroke="#334155" strokeWidth="2" strokeDasharray="4 4" />
              <text x="0" y="4" textAnchor="middle" fill="#64748B" fontSize="10">N/A</text>
            </>
          )}
        </g>

        {/* Phase 2 Nodes */}
        <text x={xPhase2} y="30" textAnchor="middle" fill="#94A3B8" fontSize="12" fontWeight="bold" letterSpacing="1">PHASE 2</text>
        {phase2.length > 0 ? (
          <>
            {phase2.map((p2, i) => {
              const yP2 = centerY - ((phase2.length - 1) * 40) + (i * 80);
              return (
                <g key={`p2-${p2.id}`} transform={`translate(${xPhase2}, ${yP2})`}>
                  <rect x="-45" y="-20" width="90" height="40" rx="6" fill={`${getStatusColor(p2.status)}33`} stroke={getStatusColor(p2.status)} strokeWidth="2" />
                  <text x="0" y="-5" textAnchor="middle" fill="#F8FAFC" fontSize="10" fontWeight="bold">{p2.toId.slice(0, 10)}</text>
                  <text x="0" y="10" textAnchor="middle" fill="#94A3B8" fontSize="9">Qty: {p2.quantity}</text>
                </g>
              );
            })}
            {phase2Hidden > 0 && (
              <g transform={`translate(${xPhase2}, ${centerY + (phase2.length * 40) + 10})`}>
                <rect x="-30" y="-10" width="60" height="20" rx="4" fill="#334155" stroke="#475569" strokeWidth="1" />
                <text x="0" y="3" textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="bold">+{phase2Hidden} more</text>
              </g>
            )}
          </>
        ) : (
          <g transform={`translate(${xPhase2}, ${centerY})`}>
            <rect x="-40" y="-15" width="80" height="30" rx="6" fill="#1E293B" stroke="#334155" strokeWidth="2" strokeDasharray="4 4" />
            <text x="0" y="3" textAnchor="middle" fill="#64748B" fontSize="10">No P2</text>
          </g>
        )}

        {/* Phase 3 Nodes */}
        <text x={xPhase3} y="30" textAnchor="middle" fill="#94A3B8" fontSize="12" fontWeight="bold" letterSpacing="1">PHASE 3</text>
        {interDistrict.length > 0 ? (
          <>
            {interDistrict.map((p3, i) => {
              const yP3 = centerY - ((interDistrict.length - 1) * 40) + (i * 80);
              const isPending = p3.status === "pending_approval";
              return (
                <g key={`p3-${p3.id}`} transform={`translate(${xPhase3}, ${yP3})`}>
                  <rect x="-50" y="-25" width="100" height="50" rx="6" fill={`${getStatusColor(p3.status)}33`} stroke={getStatusColor(p3.status)} strokeWidth="2" className={isPending ? "animate-pulse" : ""} />
                  <text x="0" y="-8" textAnchor="middle" fill="#F8FAFC" fontSize="11" fontWeight="bold">{p3.targetDistrict.district.length > 12 ? p3.targetDistrict.district.slice(0, 10) + '...' : p3.targetDistrict.district}</text>
                  <text x="0" y="6" textAnchor="middle" fill="#94A3B8" fontSize="10">Qty: {p3.quantity}</text>
                  <text x="0" y="18" textAnchor="middle" fill={getStatusColor(p3.status)} fontSize="8" fontWeight="bold" className="uppercase">{p3.status.replace("_", " ")}</text>
                </g>
              );
            })}
            {phase3Hidden > 0 && (
              <g transform={`translate(${xPhase3}, ${centerY + (interDistrict.length * 40) + 10})`}>
                <rect x="-40" y="-10" width="80" height="20" rx="4" fill="#334155" stroke="#475569" strokeWidth="1" />
                <text x="0" y="3" textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="bold">+{phase3Hidden} more</text>
              </g>
            )}
          </>
        ) : (
          <g transform={`translate(${xPhase3}, ${centerY})`}>
            <rect x="-40" y="-15" width="80" height="30" rx="6" fill="#1E293B" stroke="#334155" strokeWidth="2" strokeDasharray="4 4" />
            <text x="0" y="3" textAnchor="middle" fill="#64748B" fontSize="10">No P3</text>
          </g>
        )}

        {/* Conservation Box */}
        <g transform={`translate(${xConservation}, ${centerY})`}>
          <rect x="-60" y="-40" width="120" height="80" rx="8" fill={isConserved ? "#064E3B" : "#7F1D1D"} stroke={isConserved ? "#10B981" : "#EF4444"} strokeWidth="2" />
          <text x="0" y="-20" textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="bold" letterSpacing="1">CONSERVATION</text>
          <text x="0" y="0" textAnchor="middle" fill="#F8FAFC" fontSize="10" fontFamily="monospace">{job.totalStock} = {totalAllocated} + {job.totalStock - totalAllocated}</text>
          <text x="0" y="20" textAnchor="middle" fill={isConserved ? "#34D399" : "#F87171"} fontSize="11" fontWeight="bold">
            {isConserved ? "✓ BALANCED" : "✗ MISMATCH DETECTED"}
          </text>
        </g>

      </svg>
    </div>
  );
}
