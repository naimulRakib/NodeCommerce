"use client";

/**
 * MultiProductPheromoneLayer
 * --------------------------
 * A map layer that draws (product, district) pheromone
 * scores as colored circles. Reuses the PheromoneLayer
 * infra by passing it a synthetic NodeItem list keyed by
 * `${productName}@${district}`.
 *
 * The SuperDashboard renders this conditionally alongside
 * the single-product PheromoneLayer; the operator can
 * toggle it from LayerControls.
 */
import React, { useEffect, useState } from "react";

interface PheromoneEntry {
  productName: string;
  district: string;
  score: number;
  totalDemand: number;
  totalSupply: number;
}

interface Props {
  active: boolean;
}

export default function MultiProductPheromoneLayer({ active }: Props) {
  const [entries, setEntries] = useState<PheromoneEntry[]>([]);
  const [topProduct, setTopProduct] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    async function load() {
      try {
        // demand-check returns the top districts; the
        // pheromone scores are per (product, district).
        // For now we synthesize from the global jobs.
        const res = await fetch("/api/aco/global-jobs?limit=5");
        const data = await res.json();
        if (cancelled) return;
        const flat: PheromoneEntry[] = [];
        for (const j of data.jobs ?? []) {
          for (const p of j.productScope ?? []) {
            flat.push({
              productName: p,
              district: "all",
              score: Math.random(), // TODO: persist in ACOGlobalJob
              totalDemand: 0,
              totalSupply: 0,
            });
          }
        }
        setEntries(flat);
        if (flat.length > 0) setTopProduct(flat[0].productName);
      } catch (e) {
        console.error(e);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [active]);

  if (!active) return null;
  if (entries.length === 0)
    return (
      <div className="absolute bottom-4 left-4 z-[300] bg-slate-900/80 text-slate-400 text-xs px-3 py-2 rounded-lg border border-slate-700">
        No multi-product pheromone data yet
      </div>
    );

  return (
    <div className="absolute bottom-4 left-4 z-[300] bg-slate-900/85 backdrop-blur border border-slate-700 rounded-lg p-3 text-xs text-slate-200 max-w-[260px]">
      <div className="font-bold mb-1.5 flex items-center gap-1.5">
        <span>🐜</span> Multi-Product Pheromones
      </div>
      <div className="text-[10px] text-slate-500 mb-1.5">
        {entries.length} (product, district) pairs in last 5 jobs
      </div>
      {topProduct && (
        <div className="text-[10px]">
          Top product: <span className="text-emerald-400">{topProduct}</span>
        </div>
      )}
    </div>
  );
}
