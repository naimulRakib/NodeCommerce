"use client";

import React, { useEffect, useRef, useState } from "react";

export interface ACOPhaseData {
  phase: number;
  fromName: string;
  toName: string;
  quantity: number;
  status: "idle" | "running" | "done" | "pending_approval";
  unitsFilled?: number;
  distanceKm?: number;
}

export interface ACOFlowResult {
  phase1: { filled: number; shipments: number };
  phase2: { filled: number; shipments: number };
  phase3: { proposed: number; shipments: number };
  phase4: { shipments: number };
  conservationCheck: { balanced: boolean };
  productScope?: string[];
  totalSupply?: Record<string, number>;
}

interface Props {
  result: ACOFlowResult | null;
  isRunning: boolean;
  onReset?: () => void;
}

// Phase config
const PHASES = [
  {
    id: 1,
    icon: "🏭",
    labelBn: "বিক্রেতা",
    labelEn: "Seller",
    colorFrom: "#10B981",
    colorTo: "#059669",
    glow: "rgba(16,185,129,0.4)",
    description: "স্থানীয় বিক্রেতা থেকে উপজেলা হাবে স্টক পাঠানো হচ্ছে",
    descriptionEn: "Stock flowing from Seller → Upazilla Hub",
  },
  {
    id: 2,
    icon: "🏘️",
    labelBn: "উপজেলা",
    labelEn: "Upazilla Hub",
    colorFrom: "#3B82F6",
    colorTo: "#2563EB",
    glow: "rgba(59,130,246,0.4)",
    description: "উপজেলা থেকে জেলা হাবে স্টক রাউটিং",
    descriptionEn: "Stock routed Upazilla → District Hub",
  },
  {
    id: 3,
    icon: "🏛️",
    labelBn: "জেলা হাব",
    labelEn: "District Hub",
    colorFrom: "#F59E0B",
    colorTo: "#D97706",
    glow: "rgba(245,158,11,0.4)",
    description: "উদ্বৃত্ত স্টক অন্য জেলায় পাঠানো হচ্ছে",
    descriptionEn: "Surplus stock routed to neighbouring District",
  },
  {
    id: 4,
    icon: "🛒",
    labelBn: "চূড়ান্ত বিতরণ",
    labelEn: "Final Delivery",
    colorFrom: "#8B5CF6",
    colorTo: "#7C3AED",
    glow: "rgba(139,92,246,0.4)",
    description: "স্থানীয় রিসেলারের মাধ্যমে ক্রেতার কাছে পৌঁছে দেওয়া",
    descriptionEn: "Final delivery via Local Reseller to Buyer",
  },
];

const NODE_LABELS = [
  { icon: "🏭", labelBn: "বিক্রেতা", labelEn: "Seller" },
  { icon: "🏘️", labelBn: "উপজেলা হাব", labelEn: "Upazilla" },
  { icon: "🏛️", labelBn: "জেলা হাব", labelEn: "District" },
  { icon: "🏛️", labelBn: "অন্য জেলা", labelEn: "Other District" },
  { icon: "🛒", labelBn: "ক্রেতা", labelEn: "Buyer" },
];

// Animated dot component (CSS animation)
function FlowDots({
  active,
  color,
  count = 3,
}: {
  active: boolean;
  color: string;
  count?: number;
}) {
  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="absolute top-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 8,
            height: 8,
            background: color,
            boxShadow: `0 0 6px ${color}`,
            animation: `flowDot 1.8s ease-in-out ${i * 0.6}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function PhaseArrow({
  phaseIdx,
  active,
  done,
  color,
  quantity,
  pending,
}: {
  phaseIdx: number;
  active: boolean;
  done: boolean;
  color: string;
  quantity: number;
  pending?: boolean;
}) {
  const opacity = !active && !done ? 0.25 : 1;
  const stroke = pending ? "#F59E0B" : done ? color : active ? color : "#475569";
  return (
    <div className="flex-1 flex flex-col items-center justify-center relative min-w-[60px]" style={{ opacity }}>
      {/* Connecting line */}
      <div className="relative w-full h-0.5 flex items-center" style={{ background: done || active ? stroke : "#334155" }}>
        {/* Flowing dots */}
        {active && (
          <div className="absolute inset-0 overflow-hidden">
            {[0, 0.6, 1.2].map((delay, i) => (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                style={{
                  background: color,
                  boxShadow: `0 0 6px ${color}`,
                  animation: `flowDot 1.8s linear ${delay}s infinite`,
                }}
              />
            ))}
          </div>
        )}
        {/* Arrowhead */}
        <div
          className="absolute right-0 w-0 h-0"
          style={{
            borderTop: "5px solid transparent",
            borderBottom: "5px solid transparent",
            borderLeft: `8px solid ${done || active ? stroke : "#334155"}`,
          }}
        />
      </div>
      {/* Quantity badge */}
      {(done || active) && quantity > 0 && (
        <div
          className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ background: `${stroke}22`, color: stroke, border: `1px solid ${stroke}44` }}
        >
          {quantity} units
          {pending && <span className="ml-1 animate-pulse">⏳</span>}
        </div>
      )}
    </div>
  );
}

function NodeCircle({
  icon,
  labelBn,
  labelEn,
  active,
  done,
  color,
  glow,
  stockValue,
  isSource,
}: {
  icon: string;
  labelBn: string;
  labelEn: string;
  active: boolean;
  done: boolean;
  color: string;
  glow: string;
  stockValue?: number;
  isSource?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div
        className="relative w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all duration-500"
        style={{
          background: done || active ? `${color}22` : "#1E293B",
          border: `2px solid ${done || active ? color : "#334155"}`,
          boxShadow: (active && !done) ? `0 0 20px ${glow}, 0 0 40px ${glow}` : done ? `0 0 12px ${glow}` : "none",
        }}
      >
        {icon}
        {/* Pulse ring when active */}
        {active && !done && (
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{ background: glow }}
          />
        )}
        {done && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">✓</div>
        )}
      </div>
      <div className="text-center">
        <div className="text-[11px] font-semibold" style={{ color: done || active ? color : "#64748B" }}>
          {labelBn}
        </div>
        <div className="text-[9px] text-slate-500">{labelEn}</div>
        {stockValue !== undefined && (done || active || isSource) && (
          <div className="text-[10px] font-mono mt-0.5" style={{ color: done ? "#10B981" : "#94A3B8" }}>
            {stockValue.toLocaleString()} u
          </div>
        )}
      </div>
    </div>
  );
}

export default function ACOFlowVisualizer({ result, isRunning, onReset }: Props) {
  const [activePhase, setActivePhase] = useState<number>(0); // 0 = idle, 1-4 = animating
  const [donePhases, setDonePhases] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Extract quantities from result
  const p1qty = result?.phase1?.filled ?? 0;
  const p2qty = result?.phase2?.filled ?? 0;
  const p3qty = result?.phase3?.proposed ?? 0;
  const p4qty = p3qty > 0 ? Math.round(p3qty * 0.5) : 0;
  const totalSupply = Object.values(result?.totalSupply ?? {}).reduce((a, b) => a + b, 0);
  const conserved = result?.conservationCheck?.balanced ?? false;

  // Run animation sequence when result arrives or isRunning starts
  useEffect(() => {
    if (!isRunning && !result) {
      setActivePhase(0);
      setDonePhases(new Set());
      return;
    }

    if (isRunning) {
      // Start phase 1 immediately
      setActivePhase(1);
      setDonePhases(new Set());
      return;
    }

    if (result) {
      // Sequence through phases
      setDonePhases(new Set());
      const phaseOrder = [1, 2, 3, 4];
      let idx = 0;

      const runNext = () => {
        if (idx < phaseOrder.length) {
          setActivePhase(phaseOrder[idx]);
          idx++;
          timerRef.current = setTimeout(() => {
            setDonePhases((prev) => {
              const next = new Set(prev);
              next.add(phaseOrder[idx - 1]);
              return next;
            });
            runNext();
          }, 1400);
        } else {
          setActivePhase(0);
        }
      };
      runNext();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isRunning, result]);

  const nodeStates = [
    // Seller node
    { active: activePhase === 1, done: donePhases.has(1) },
    // Upazilla node — done after phase 1 completes
    { active: activePhase === 2, done: donePhases.has(2) },
    // District node — done after phase 2 completes
    { active: activePhase === 3, done: donePhases.has(3) },
    // Other District — phase 3
    { active: activePhase === 4, done: donePhases.has(4) },
    // Buyer — phase 4
    { active: false, done: donePhases.has(4) },
  ];

  const arrowStates = [
    { quantity: p1qty, active: activePhase === 1, done: donePhases.has(1), color: "#10B981" },
    { quantity: p2qty, active: activePhase === 2, done: donePhases.has(2), color: "#3B82F6" },
    { quantity: p3qty, active: activePhase === 3, done: donePhases.has(3), color: "#F59E0B", pending: !conserved && p3qty > 0 },
    { quantity: p4qty, active: activePhase === 4, done: donePhases.has(4), color: "#8B5CF6" },
  ];

  const isIdle = !isRunning && !result && activePhase === 0;

  return (
    <div className="w-full bg-slate-900/80 border border-slate-700/60 rounded-2xl p-5 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span className="text-base">🐜</span>
            <span>ACO ৪-ধাপ স্টক ফ্লো</span>
            <span className="text-slate-500 font-normal text-xs">4-Phase Pipeline</span>
          </h3>
          {result?.productScope && (
            <div className="text-[10px] text-slate-500 mt-0.5">
              পণ্য: {result.productScope.join(", ")}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold animate-pulse">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              চলছে... / Running
            </div>
          )}
          {result && !isRunning && (
            <div
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                conserved
                  ? "bg-emerald-900/50 text-emerald-400 border border-emerald-500/30"
                  : "bg-amber-900/50 text-amber-400 border border-amber-500/30"
              }`}
            >
              {conserved ? "✓ Conservation OK" : "⚠ Check Conservation"}
            </div>
          )}
          {onReset && result && (
            <button
              onClick={onReset}
              className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer px-2 py-0.5 rounded border border-slate-700 hover:border-slate-500 transition-colors"
            >
              ↺ Reset
            </button>
          )}
        </div>
      </div>

      {/* Flow Diagram */}
      <div className="flex items-center gap-0 overflow-x-auto pb-2">
        {NODE_LABELS.map((node, i) => (
          <React.Fragment key={i}>
            <NodeCircle
              icon={node.icon}
              labelBn={node.labelBn}
              labelEn={node.labelEn}
              active={nodeStates[i]?.active ?? false}
              done={nodeStates[i]?.done ?? false}
              color={PHASES[Math.max(0, i - 1)]?.colorFrom ?? "#64748B"}
              glow={PHASES[Math.max(0, i - 1)]?.glow ?? "rgba(100,116,139,0.3)"}
              stockValue={
                i === 0 ? totalSupply || undefined :
                i === 1 ? (p1qty || undefined) :
                i === 2 ? (p2qty || undefined) :
                i === 3 ? (p3qty || undefined) :
                (p4qty || undefined)
              }
              isSource={i === 0}
            />
            {i < NODE_LABELS.length - 1 && (
              <PhaseArrow
                phaseIdx={i}
                active={arrowStates[i]?.active ?? false}
                done={arrowStates[i]?.done ?? false}
                color={arrowStates[i]?.color ?? "#64748B"}
                quantity={arrowStates[i]?.quantity ?? 0}
                pending={arrowStates[i]?.pending}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Phase legend */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {PHASES.map((phase) => {
          const isDone = donePhases.has(phase.id);
          const isActive = activePhase === phase.id;
          const qty =
            phase.id === 1 ? p1qty :
            phase.id === 2 ? p2qty :
            phase.id === 3 ? p3qty :
            p4qty;

          return (
            <div
              key={phase.id}
              className="flex items-start gap-2 p-2 rounded-xl transition-all duration-300"
              style={{
                background: isActive
                  ? `${phase.colorFrom}15`
                  : isDone
                  ? `${phase.colorFrom}0a`
                  : "transparent",
                border: `1px solid ${isActive ? phase.colorFrom + "50" : isDone ? phase.colorFrom + "25" : "#1E293B"}`,
              }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
                style={{
                  background: isDone || isActive ? phase.colorFrom : "#1E293B",
                  color: isDone || isActive ? "#fff" : "#64748B",
                }}
              >
                {isDone ? "✓" : `P${phase.id}`}
              </div>
              <div>
                <div className="text-[10px] font-semibold" style={{ color: isDone || isActive ? phase.colorFrom : "#64748B" }}>
                  {phase.labelBn}
                  {qty > 0 && (isDone || isActive) && (
                    <span className="ml-1 font-mono opacity-80">({qty})</span>
                  )}
                </div>
                <div className="text-[9px] text-slate-600 leading-tight">{phase.descriptionEn}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Idle placeholder */}
      {isIdle && (
        <div className="mt-3 text-center text-[11px] text-slate-600 italic">
          ACO ফোরকাস্ট চালানোর পরে এখানে লাইভ স্টক ফ্লো দেখা যাবে
          <div className="text-[10px] text-slate-700">Run ACO Forecast to see live stock flow animation</div>
        </div>
      )}

      {/* Inline CSS for the dot animation */}
      <style>{`
        @keyframes flowDot {
          0%   { left: -5%; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
