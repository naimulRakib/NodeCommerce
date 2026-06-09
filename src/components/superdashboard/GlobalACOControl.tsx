"use client";

/**
 * GlobalACOControl
 * ----------------
 * The SuperDashboard's "Trigger Multi-Product ACO" button.
 * Mirrors ACOTriggerControl (single-product) but runs the
 * 4-phase global pipeline. Calls /api/aco/demand-check first
 * to show the operator a per-product preview, then fires
 * /api/aco/global-trigger.
 *
 * On success, refreshes the parent via `onJobComplete(job)`.
 */
import React, { useEffect, useState } from "react";

interface ProductPreview {
  name: string;
  totalPending: number;
  totalReserved: number;
  effectiveDeficit: number;
}

interface PendingPhase3Shipment {
  id: string;
  fromName: string;
  toName: string;
  totalQuantity: number;
  expiresAt: string;
  lineItemCount: number;
  lineItemSummary: string;
}

interface DemandCheck {
  productCount: number;
  products: ProductPreview[];
  topDistricts: { district: string; pending: number }[];
  pendingTransferCount: number;
  pendingPhase3Shipments: number | PendingPhase3Shipment[];
  lastGlobalJob?: { id: string; status: string; startedAt: string };
}

interface GlobalACOControlProps {
  onJobComplete?: (job: any) => void;
}

export default function GlobalACOControl({ onJobComplete }: GlobalACOControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [sourceDistrict, setSourceDistrict] = useState<string>("");
  const [maxPhases, setMaxPhases] = useState<1 | 2 | 3 | 4>(4);
  const [preview, setPreview] = useState<DemandCheck | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    // load product list on first open
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => {
        const names = Array.isArray(data)
          ? data.map((p: any) => p.name).filter(Boolean)
          : [];
        setAvailableProducts(names);
      })
      .catch(() => setAvailableProducts([]));
  }, [isOpen]);

  async function loadPreview() {
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/aco/demand-check", {
        method: "GET",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load preview");
      }
      setPreview(data);
    } catch (e: any) {
      console.error(e);
      alert(e.message);
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleRun() {
    if (selected.length === 0) {
      alert("Select at least one product");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/aco/global-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productScope: selected,
          triggerType: "manual",
          sourceDistrict: sourceDistrict || undefined,
          maxPhases,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to trigger global ACO");
      }
      setResult(data);
      if (onJobComplete) onJobComplete(data);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRunning(false);
    }
  }

  function toggleProduct(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  if (!isOpen) {
    return (
      <div className="absolute top-4 right-44 z-[400]">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-full font-bold shadow-lg shadow-emerald-600/30 border border-emerald-500/50 transition-all active:scale-95"
        >
          <span>🚛</span> Global ACO
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-4 right-44 z-[400] w-[340px] bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl text-slate-200 max-h-[80vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-slate-100 flex items-center gap-2">
          <span>🚛</span> Multi-Product ACO
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
            Product Scope ({selected.length} selected)
          </label>
          <div className="max-h-32 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs">
            {availableProducts.length === 0 ? (
              <div className="text-slate-500 italic">Loading…</div>
            ) : (
              availableProducts.map((p) => (
                <label
                  key={p}
                  className="flex items-center gap-2 py-0.5 hover:bg-slate-700/50 px-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(p)}
                    onChange={() => toggleProduct(p)}
                  />
                  <span className="truncate">{p}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 mb-1 block">
            Source District (optional)
          </label>
          <input
            value={sourceDistrict}
            onChange={(e) => setSourceDistrict(e.target.value)}
            placeholder="e.g. Dhaka"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 mb-1 block">
            Max Phases
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((p) => (
              <button
                key={p}
                onClick={() => setMaxPhases(p as 1 | 2 | 3 | 4)}
                className={`flex-1 py-1 rounded text-xs font-bold ${
                  maxPhases === p
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                P{p}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={loadPreview}
          disabled={loadingPreview}
          className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold py-1.5 rounded"
        >
          {loadingPreview ? "Checking…" : "🔍 Preview demand first"}
        </button>

        {preview && (
          <div className="text-xs bg-slate-800/60 p-2 rounded border border-slate-700 space-y-1">
            <div className="text-slate-300 font-bold">
              {preview.productCount || 0} products in scope
            </div>
            {(Array.isArray(preview.products) ? preview.products : []).slice(0, 5).map((p: any, idx: number) => (
              <div key={p?.productName || p?.name || `product-${idx}`} className="flex justify-between text-slate-400">
                <span className="truncate">{p?.productName || p?.name || `Unknown Product ${idx}`}</span>
                <span className="text-amber-400">−{Number(p?.totalEffectiveDeficit ?? p?.effectiveDeficit ?? 0)}</span>
              </div>
            ))}
            <div className="text-slate-500 italic">
              {Array.isArray(preview.pendingPhase3Shipments) ? preview.pendingPhase3Shipments.length : (preview.pendingPhase3Shipments || 0)} pending Phase 3 shipments
            </div>
          </div>
        )}

        <button
          onClick={handleRun}
          disabled={running || selected.length === 0}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2 rounded-lg flex justify-center items-center gap-2"
        >
          {running ? "Routing…" : "Run 4-Phase Pipeline →"}
        </button>

        {result && (
          <div className="text-xs bg-slate-800/60 p-2 rounded border border-emerald-500/30 space-y-1">
            <div className="text-emerald-400 font-bold">Pipeline complete ✓</div>
            <div className="text-slate-300">Job: {String(result.globalJobId || result.jobId || "").slice(0, 8)}</div>
            <div className="text-slate-300">
              Shipments:{" "}
              <span className="text-emerald-300">P1: {result.summary?.phase1?.shipments ?? 0}</span>{" "}
              <span className="text-blue-300">P2: {result.summary?.phase2?.shipments ?? 0}</span>{" "}
              <span className="text-amber-300">P3: {result.summary?.phase3?.shipments ?? 0}</span>{" "}
              <span className="text-slate-400">P4: {result.summary?.phase4?.shipments ?? 0}</span>
            </div>
            <div className="text-slate-300">
              Units moved:{" "}
              P1: {result.summary?.phase1?.filled ?? 0}{" "}
              P2: {result.summary?.phase2?.filled ?? 0}{" "}
              P3: {result.summary?.phase3?.proposed ?? 0}
            </div>
            <div className="text-slate-400">
              Conservation:{" "}
              {result.summary?.conservationCheck?.balanced ? (
                <span className="text-emerald-400">✓ balanced</span>
              ) : (
                <span className="text-red-400">✗ unbalanced (surplus stock not yet routed is normal)</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
