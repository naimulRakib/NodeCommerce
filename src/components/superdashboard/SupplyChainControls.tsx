"use client";

import { useState } from "react";

interface SupplyChainControlsProps {
  onReset?: () => void;
}

type Action = "idle" | "confirming-full" | "resetting" | "seeding" | "done" | "error";

export default function SupplyChainControls({ onReset }: SupplyChainControlsProps) {
  const [action, setAction] = useState<Action>("idle");
  const [message, setMessage] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleFullReset() {
    setAction("resetting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/supply-chain/history-reset", {
        method: "POST",
        headers: { "X-Internal-Secret": "dev-secret" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setMessage(`${data.totalDeleted} records wiped — seller stock & demands preserved`);
      setAction("done");
      onReset?.();
    } catch (e: any) {
      setErrorMsg(e.message);
      setAction("error");
    }
  }

  async function handleSeedDemands() {
    setAction("seeding");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/supply-chain/seed-demands", {
        method: "POST",
        headers: {
          "X-Internal-Secret": "dev-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ minQty: 50, maxQty: 500 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Seed failed");
      setMessage(
        `${data.upazillaDemandsCreated} upazilla demands + ${data.districtDemandsCreated} district demands seeded`
      );
      setAction("done");
    } catch (e: any) {
      setErrorMsg(e.message);
      setAction("error");
    }
  }

  // ── Confirmation dialog ──
  if (action === "confirming-full") {
    return (
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[600] bg-red-950 border-2 border-red-500 rounded-2xl p-5 shadow-2xl w-[400px] text-white">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="font-bold text-red-200 text-sm">Reset ACO History</div>
            <div className="text-[11px] text-red-400">This CANNOT be undone</div>
          </div>
        </div>
        <p className="text-xs text-red-200 mb-2">Will permanently delete:</p>
        <ul className="text-xs text-red-300 mb-3 space-y-0.5 list-disc list-inside">
          <li>All ACO jobs, shipments, trucks, negotiations</li>
          <li>All stock at reseller warehouses (upazilla / district / local)</li>
          <li>All stock transfers &amp; pheromone trails</li>
          <li>All realtime notifications</li>
        </ul>
        <p className="text-[11px] text-emerald-400 mb-4">
          ✓ Seller stock quantities, product demands, and all accounts are preserved.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleFullReset}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg text-sm transition-all active:scale-95"
          >
            Yes, Reset Everything
          </button>
          <button
            onClick={() => setAction("idle")}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2 rounded-lg text-sm transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Loading states ──
  if (action === "resetting" || action === "seeding") {
    return (
      <div className="absolute top-4 right-[700px] z-[400]">
        <div className="flex items-center gap-2 bg-slate-900 border border-amber-500/50 text-amber-300 px-4 py-2 rounded-full text-sm font-bold shadow-lg animate-pulse">
          <span>⏳</span>
          {message || (action === "resetting" ? "Resetting supply chain…" : "Seeding demands…")}
        </div>
      </div>
    );
  }

  // ── Done ──
  if (action === "done") {
    return (
      <div className="absolute top-4 right-[700px] z-[400]">
        <div
          className="flex items-center gap-2 bg-slate-900 border border-emerald-500/50 text-emerald-300 px-4 py-2 rounded-full text-sm font-bold shadow-lg cursor-pointer"
          onClick={() => setAction("idle")}
          title={message}
        >
          <span>✓</span> {message} (click to dismiss)
        </div>
      </div>
    );
  }

  // ── Error ──
  if (action === "error") {
    return (
      <div className="absolute top-4 right-[700px] z-[400]">
        <div
          className="flex items-center gap-2 bg-slate-900 border border-red-500/50 text-red-400 px-4 py-2 rounded-full text-sm font-bold shadow-lg cursor-pointer"
          onClick={() => setAction("idle")}
        >
          <span>✗</span> {errorMsg || "Failed"} (click to dismiss)
        </div>
      </div>
    );
  }

  async function handleAutoPilot() {
    setAction("seeding");
    setErrorMsg(null);
    try {
      // 1. Seed Demands
      setMessage("Step 1: Seeding fake demands...");
      const seedRes = await fetch("/api/supply-chain/seed-demands", {
        method: "POST",
        headers: { "X-Internal-Secret": "dev-secret", "Content-Type": "application/json" },
        body: JSON.stringify({ minQty: 50, maxQty: 500 }),
      });
      if (!seedRes.ok) throw new Error("Seed failed");

      // 2. Trigger ACO
      setAction("resetting");
      setMessage("Step 2: Running ACO Math Engine...");
      const acoRes = await fetch("/api/supply-chain/trigger-aco", {
        method: "POST",
        headers: { "X-Internal-Secret": "dev-secret" }
      });
      if (!acoRes.ok) {
        if (acoRes.status === 429) {
          const errData = await acoRes.json().catch(() => ({}));
          throw new Error(errData.message || "Rate limit exceeded. Please wait.");
        }
        throw new Error("ACO trigger failed");
      }
      
      // 3. Auto-Drive Trucks and Auto-Approve Shipments
      setMessage("Step 3: Auto-driving trucks & approving Phase 3...");
      
      let driving = true;
      let cycles = 0;
      while (driving && cycles < 15) { // max 15 cycles
        cycles++;
        const driveRes = await fetch("/api/supply-chain/magic-demo-drive", { method: "POST" });
        const driveData = await driveRes.json();
        
        if (!driveRes.ok) throw new Error("Failed to drive trucks");
        
        onReset?.(); // refresh map state so user sees updates
        
        if (driveData.activeTrucksRemaining === 0 && driveData.shipmentsApproved === 0) {
          // If no trucks are moving AND no shipments were approved in this tick, we might be done.
          // Wait one more tick to be sure nothing else generates.
          if (cycles > 3) driving = false; 
        }
        
        await new Promise(r => setTimeout(r, 2000)); // wait 2 seconds between ticks
      }

      setMessage("Auto-Pilot Complete! Supply chain executed.");
      setAction("done");
      onReset?.();
    } catch (e: any) {
      setErrorMsg(e.message);
      setAction("error");
    }
  }

  // ── Idle — buttons ──
  return (
    <div className="absolute top-4 right-[700px] z-[400] flex items-center gap-2">
      <button
        onClick={handleAutoPilot}
        className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 py-2 rounded-full font-bold text-sm shadow-[0_0_15px_rgba(124,58,237,0.5)] transition-all duration-200 active:scale-95"
        title="Run the entire demo automatically: Seed Demands, Run ACO, Approve Shipments, Drive Trucks"
      >
        <span>▶️</span> Magic Auto-Pilot Demo
      </button>

      <button
        onClick={() => setAction("confirming-full")}
        className="flex items-center gap-1.5 bg-slate-900/90 hover:bg-red-950 border border-slate-600 hover:border-red-500 text-slate-400 hover:text-red-300 px-3 py-2 rounded-full font-semibold text-xs shadow-lg transition-all duration-200 active:scale-95"
        title="Wipe all transactional data — demands, ACO, trucks, transfers"
      >
        <span>🗑️</span> Full Reset
      </button>
      <button
        onClick={handleSeedDemands}
        className="flex items-center gap-1.5 bg-slate-900/90 hover:bg-blue-950 border border-slate-600 hover:border-blue-500 text-slate-400 hover:text-blue-300 px-3 py-2 rounded-full font-semibold text-xs shadow-lg transition-all duration-200 active:scale-95"
        title="Seed random demands across all upazilla resellers"
      >
        <span>🌱</span> Seed Demands
      </button>
    </div>
  );
}
