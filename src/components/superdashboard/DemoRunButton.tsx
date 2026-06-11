"use client";

/**
 * DemoRunButton
 * ─────────────
 * Single "🚀 ACO ফোরকাস্ট চালান" button that:
 *  1. Fires the Grok terminal immediately (onGrokStart callback)
 *  2. Calls /api/aco/demand-check to auto-detect eligible products
 *  3. Calls /api/aco/global-trigger with all eligible products
 *  4. Returns the job result via onJobComplete
 *
 * Option A chosen by user: one button, zero configuration.
 */

import React, { useState } from "react";

interface Props {
  onGrokStart: () => void;
  onJobComplete: (result: any) => void;
  onError?: (msg: string) => void;
}

type Phase = "idle" | "checking" | "running" | "done" | "error";

const STEP_LABELS: Record<string, { bn: string; en: string }> = {
  checking: { bn: "চাহিদা যাচাই করা হচ্ছে...", en: "Checking demand..." },
  running:  { bn: "ACO পাইপলাইন চলছে...", en: "Running ACO pipeline..." },
  done:     { bn: "সম্পন্ন! ✓", en: "Complete!" },
  error:    { bn: "ত্রুটি হয়েছে", en: "Error occurred" },
};

export default function DemoRunButton({ onGrokStart, onJobComplete, onError }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [stepDetail, setStepDetail] = useState("");
  const [lastResult, setLastResult] = useState<any>(null);

  const run = async () => {
    if (phase === "running" || phase === "checking") return;

    // Fire Grok terminal IMMEDIATELY — before any API call
    onGrokStart();

    setPhase("checking");
    setLastResult(null);

    try {
      // Step 1: Auto-detect eligible products
      setStepDetail("চাহিদা ডেটা লোড হচ্ছে...");
      const checkRes = await fetch("/api/aco/demand-check");
      const checkData = await checkRes.json();

      if (!checkRes.ok) {
        throw new Error(checkData.error || "Demand check failed");
      }

      const eligibleProducts: string[] = checkData.eligibleProducts ?? [];

      // Fallback: if no demands yet, try any stocked product names
      let productScope = eligibleProducts;
      if (productScope.length === 0) {
        // Seed demand from visible seller stock
        const stockRes = await fetch("/api/products/search?page=1&pageSize=20");
        const stockData = await stockRes.json();
        const names: string[] = (stockData.products ?? [])
          .map((p: any) => p.name)
          .filter(Boolean)
          .filter((name: string, i: number, arr: string[]) => arr.indexOf(name) === i);
        productScope = names;
      }

      if (productScope.length === 0) {
        throw new Error("কোনো পণ্য পাওয়া যায়নি। বিক্রেতার স্টক যোগ করুন। (No products found with stock > 0)");
      }

      // Step 2: Trigger global ACO
      setPhase("running");
      setStepDetail(`${productScope.length}টি পণ্যের জন্য ACO চলছে...`);

      const triggerRes = await fetch("/api/aco/global-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productScope,
          triggerType: "manual",
          maxPhases: 4,
        }),
      });
      const triggerData = await triggerRes.json();

      if (!triggerRes.ok) {
        throw new Error(triggerData.message || triggerData.error || "ACO trigger failed");
      }

      setPhase("done");
      setLastResult(triggerData);
      onJobComplete(triggerData);

    } catch (err: any) {
      console.error("[DemoRunButton]", err);
      setPhase("error");
      setStepDetail(err.message);
      onError?.(err.message);
    }
  };

  const reset = () => {
    setPhase("idle");
    setStepDetail("");
    setLastResult(null);
  };

  const isLoading = phase === "checking" || phase === "running";
  const stepInfo = STEP_LABELS[phase];

  return (
    <div className="flex flex-col gap-2">
      {/* Main button */}
      <button
        id="demo-run-aco-btn"
        onClick={run}
        disabled={isLoading}
        className={`
          relative flex items-center justify-center gap-2
          w-full px-5 py-3 rounded-2xl font-bold text-sm
          transition-all duration-300 active:scale-95
          overflow-hidden cursor-pointer
          disabled:cursor-not-allowed
          ${isLoading
            ? "bg-slate-800 border border-slate-600 text-slate-400"
            : phase === "done"
            ? "bg-emerald-600/20 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/30"
            : phase === "error"
            ? "bg-red-900/20 border border-red-500/50 text-red-300 hover:bg-red-900/30"
            : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/30 border border-violet-500/40"
          }
        `}
      >
        {/* Animated shimmer when loading */}
        {isLoading && (
          <div
            className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite]"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
            }}
          />
        )}

        {/* Icon */}
        <span className="text-base">
          {isLoading ? "⏳" : phase === "done" ? "✅" : phase === "error" ? "⚠️" : "🚀"}
        </span>

        {/* Label */}
        <span className="flex flex-col items-start leading-tight">
          <span>
            {isLoading
              ? (phase === "checking" ? "চাহিদা যাচাই..." : "ACO চলছে...")
              : phase === "done"
              ? "ACO সম্পন্ন ✓"
              : phase === "error"
              ? "পুনরায় চেষ্টা করুন"
              : "ACO ফোরকাস্ট চালান"}
          </span>
          <span className="text-[10px] opacity-70 font-normal">
            {isLoading
              ? (phase === "checking" ? "Checking demand..." : "Running 4-Phase Pipeline...")
              : phase === "done"
              ? "Pipeline complete"
              : phase === "error"
              ? "Click to retry"
              : "Run 4-Phase ACO Forecast"}
          </span>
        </span>

        {/* Pulse dot */}
        {phase === "idle" && (
          <span className="ml-auto w-2 h-2 rounded-full bg-violet-300 animate-pulse" />
        )}
        {isLoading && (
          <span className="ml-auto flex gap-0.5">
            {[0, 0.15, 0.3].map((d, i) => (
              <span
                key={i}
                className="w-1 h-1 bg-slate-400 rounded-full"
                style={{ animation: `bounce 0.8s ease-in-out ${d}s infinite alternate` }}
              />
            ))}
          </span>
        )}
      </button>

      {/* Step detail */}
      {(isLoading || phase === "error") && stepDetail && (
        <div className={`text-[10px] px-3 py-1.5 rounded-lg font-mono flex items-center gap-1.5 ${
          phase === "error"
            ? "bg-red-900/20 text-red-400 border border-red-500/20"
            : "bg-slate-800/60 text-slate-400 border border-slate-700/60"
        }`}>
          {phase === "error" ? "✗" : "›"}
          <span className="truncate">{stepDetail}</span>
        </div>
      )}

      {/* Result summary */}
      {phase === "done" && lastResult && (
        <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-xl p-3 flex flex-col gap-1.5 text-xs">
          <div className="font-bold text-emerald-400 mb-0.5">📊 ফলাফল / Results</div>
          <div className="grid grid-cols-2 gap-1">
            <div className="text-slate-400">
              ধাপ-১ <span className="text-emerald-300 font-mono">{lastResult.summary?.phase1?.filled ?? 0} u</span>
            </div>
            <div className="text-slate-400">
              ধাপ-২ <span className="text-blue-300 font-mono">{lastResult.summary?.phase2?.filled ?? 0} u</span>
            </div>
            <div className="text-slate-400">
              ধাপ-৩ <span className="text-amber-300 font-mono">{lastResult.summary?.phase3?.proposed ?? 0} u</span>
            </div>
            <div className="text-slate-400">
              সংরক্ষণ{" "}
              {lastResult.summary?.conservationCheck?.balanced
                ? <span className="text-emerald-400">✓ ঠিক আছে</span>
                : <span className="text-amber-400">⚠ দেখুন</span>
              }
            </div>
          </div>
          <button
            onClick={reset}
            className="mt-1 text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer transition-colors text-left"
          >
            ↺ নতুন রান করুন / Run again
          </button>
        </div>
      )}

      <style>{`
        @keyframes shimmer { to { transform: translateX(400%); } }
        @keyframes bounce { to { transform: translateY(-4px); } }
      `}</style>
    </div>
  );
}
