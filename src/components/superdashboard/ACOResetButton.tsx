"use client";

import { useState } from "react";

interface ACOResetButtonProps {
  onReset?: () => void;
}

export default function ACOResetButton({ onReset }: ACOResetButtonProps) {
  const [state, setState] = useState<"idle" | "confirming" | "resetting" | "done" | "error">("idle");
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleReset() {
    setState("resetting");
    setErrorMsg(null);
    setResult(null);
    try {
      const res = await fetch("/api/aco/reset", {
        method: "POST",
        headers: {
          // Must match INTERNAL_SECRET env var on the server (falls back to "dev-secret" in local dev)
          "X-Internal-Secret": "dev-secret",
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setResult(data.deleted);
      setState("done");
      onReset?.();
    } catch (e: any) {
      setErrorMsg(e.message);
      setState("error");
    }
  }

  if (state === "confirming") {
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] bg-red-950 border-2 border-red-500 rounded-2xl p-4 shadow-2xl w-[360px] text-white">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">⚠️</span>
          <span className="font-bold text-red-300 text-sm">Hard Reset ACO</span>
        </div>
        <p className="text-xs text-red-200 mb-4">
          This will permanently delete <strong>all</strong> ACO jobs, shipments,
          trucks, negotiations, and realtime notifications. This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg text-sm transition-all active:scale-95"
          >
            Yes, Reset Everything
          </button>
          <button
            onClick={() => setState("idle")}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2 rounded-lg text-sm transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (state === "resetting") {
    return (
      <div className="absolute top-4 right-[700px] z-[400]">
        <div className="flex items-center gap-2 bg-slate-900 border border-red-500/50 text-red-300 px-4 py-2 rounded-full text-sm font-bold shadow-lg animate-pulse">
          <span>🔄</span> Resetting ACO data…
        </div>
      </div>
    );
  }

  if (state === "done") {
    const total = result
      ? Object.values(result as Record<string, number>).reduce((a, b) => a + b, 0)
      : 0;
    return (
      <div className="absolute top-4 right-[700px] z-[400]">
        <div
          className="flex items-center gap-2 bg-slate-900 border border-emerald-500/50 text-emerald-300 px-4 py-2 rounded-full text-sm font-bold shadow-lg cursor-pointer"
          onClick={() => setState("idle")}
          title={JSON.stringify(result, null, 2)}
        >
          <span>✓</span> Reset complete — {total} records deleted
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="absolute top-4 right-[700px] z-[400]">
        <div
          className="flex items-center gap-2 bg-slate-900 border border-red-500/50 text-red-400 px-4 py-2 rounded-full text-sm font-bold shadow-lg cursor-pointer"
          onClick={() => setState("idle")}
        >
          <span>✗</span> {errorMsg || "Reset failed"} (click to dismiss)
        </div>
      </div>
    );
  }

  // idle
  return (
    <div className="absolute top-4 right-[700px] z-[400]">
      <button
        onClick={() => setState("confirming")}
        className="flex items-center gap-2 bg-slate-900/90 hover:bg-red-950 border border-slate-600 hover:border-red-500 text-slate-400 hover:text-red-300 px-4 py-2 rounded-full font-semibold text-xs shadow-lg transition-all duration-200 active:scale-95"
        title="Wipe all ACO jobs, shipments, trucks, negotiations"
      >
        <span>🗑️</span> Reset ACO
      </button>
    </div>
  );
}
