"use client";

import React, { useState } from "react";

interface ACOTriggerControlProps {
  onJobComplete: (job: any) => void;
}

export default function ACOTriggerControl({ onJobComplete }: ACOTriggerControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [lastJobResult, setLastJobResult] = useState<any | null>(null);

  const handleTrigger = async () => {
    if (!selectedProductId) {
      alert("Please enter a seller product ID");
      return;
    }

    setTriggerLoading(true);
    setLastJobResult(null);

    try {
      const res = await fetch("/api/aco/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerProductId: selectedProductId,
          triggerType: "manual",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to trigger ACO");
      }

      setLastJobResult(data);
      if (onJobComplete) {
        onJobComplete(data);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setTriggerLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="absolute top-4 right-4 z-[400]">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-full font-bold shadow-lg shadow-purple-600/30 border border-purple-500/50 transition-all active:scale-95"
        >
          <span>🐜</span> ACO
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-4 right-4 z-[400] w-[280px] bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl text-slate-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-100 flex items-center gap-2">
          <span>🐜</span> ACO Routing Engine
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-400 mb-1 block">
            Seller Product ID
          </label>
          <input
            type="text"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            placeholder="Route stock for product..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <button
          onClick={handleTrigger}
          disabled={triggerLoading}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-2 rounded-lg flex justify-center items-center gap-2 transition-colors"
        >
          {triggerLoading ? "Routing..." : "Trigger ACO Pipeline →"}
        </button>

        {triggerLoading && (
          <div className="mt-4 bg-slate-800 p-3 rounded-lg border border-slate-700 text-xs font-mono">
            <div className="text-purple-400 animate-pulse mb-1">Processing via ACO pipeline:</div>
            <div className="flex justify-between text-slate-400">
              <span>Seller</span> <span className="animate-ping">→</span> <span>[P1]</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Upazilla</span> <span className="animate-ping">→</span> <span>[P2]</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>District</span> <span className="animate-ping">→</span> <span>[P3]</span>
            </div>
          </div>
        )}

        {lastJobResult && !triggerLoading && (
          <div className="mt-2 bg-slate-800/50 p-3 rounded-lg border border-emerald-500/30 text-xs flex flex-col gap-1.5">
            <div className="text-emerald-400 font-bold mb-1">Routing Complete!</div>
            <div className="text-slate-300">✓ Phase 1: {lastJobResult.summary.phase1.filled} units</div>
            <div className="text-slate-300">✓ Phase 2: {lastJobResult.summary.phase2.filled} units</div>
            {lastJobResult.summary.phase3.opportunities > 0 ? (
              <div className="text-amber-400">⏳ Phase 3: {lastJobResult.summary.phase3.proposed} units (awaiting approval)</div>
            ) : (
              <div className="text-slate-300">✓ Phase 3: {lastJobResult.summary.phase3.proposed} units</div>
            )}
            <div className="text-slate-400 mt-1 border-t border-slate-700 pt-1">
              Conservation: {lastJobResult.summary.conservationCheck.balanced ? <span className="text-emerald-400">✓ balanced</span> : <span className="text-red-400">✗ unbalanced</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
