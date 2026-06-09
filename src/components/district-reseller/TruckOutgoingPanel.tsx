"use client";

import React, { useState, useEffect, useRef } from "react";

export default function TruckOutgoingPanel({ districtId }: { districtId?: string }) {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(false);

  const fetchOutgoingTrucks = async () => {
    try {
      // Like Incoming, we mock endpoint filtering for demo purposes.
      // In a real implementation this would fetch `GET /api/aco/trucks?jobId=latest` or a specific outgoing endpoint.
      const res = await fetch("/api/aco/trucks?jobId=latest");
      if (!res.ok) return;
      const data = await res.json();
      
      if (isMounted.current) {
        setTrucks(data.trucks || []);
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      if (isMounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      if (!isMounted.current) return;
      await fetchOutgoingTrucks();
      if (!isMounted.current) return;
      timeoutId = setTimeout(poll, 15000);
    };

    poll();

    return () => {
      isMounted.current = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [districtId]);

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading active trucks...</div>;

  const activeTrucks = trucks.filter(t => t.status !== "completed");
  const completedTrucks = trucks.filter(t => t.status === "completed");

  // Aggregate product metrics
  const productAggregates: Record<string, { loaded: number; delivered: number }> = {};
  trucks.forEach(t => {
    t.stops.forEach((s: any, stopIdx: number) => {
      s.items.forEach((item: any) => {
        if (!productAggregates[item.productName]) {
          productAggregates[item.productName] = { loaded: 0, delivered: 0 };
        }
        
        // If it's a pickup, it's loaded. We'll use plannedQty for simplification, or confirmedQty if available
        const qty = item.confirmedQty !== undefined ? item.confirmedQty : item.plannedQty;
        
        if (s.stopType === "pickup" && stopIdx < t.currentStopIndex) {
          productAggregates[item.productName].loaded += qty;
        }
        if (s.stopType === "delivery" && stopIdx < t.currentStopIndex) {
          productAggregates[item.productName].delivered += qty;
        }
      });
    });
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 font-sans">
      {/* Summary Header */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold tracking-tight mb-4">District Logistics Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-blue-200 text-sm font-semibold uppercase tracking-wider mb-1">Active Trucks</p>
            <p className="text-4xl font-black">{activeTrucks.length}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-blue-200 text-sm font-semibold uppercase tracking-wider mb-1">Completed Today</p>
            <p className="text-4xl font-black">{completedTrucks.length}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-blue-200 text-sm font-semibold uppercase tracking-wider mb-1">Products In Transit</p>
            <div className="text-sm space-y-1 mt-2 max-h-20 overflow-y-auto pr-2 custom-scrollbar">
              {Object.entries(productAggregates).map(([name, stats]) => {
                const inTransit = stats.loaded - stats.delivered;
                if (inTransit <= 0) return null;
                return (
                  <div key={name} className="flex justify-between border-b border-white/20 pb-1">
                    <span className="font-medium text-white">{name}</span>
                    <span className="text-emerald-400 font-bold">{inTransit}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Truck List */}
      <div className="space-y-6">
        {trucks.map(truck => {
          return (
            <div key={truck.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🚛</span>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">Truck {truck.truckCode}</h3>
                    <p className="text-xs font-semibold text-gray-500 uppercase">
                      Status: <span className={truck.status === 'completed' ? 'text-emerald-600' : 'text-blue-600'}>{truck.status}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2">
                {/* Visual Route Sequence */}
                <div className="p-6 border-r border-gray-100">
                  <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">Route Sequence</h4>
                  <div className="space-y-4">
                    {truck.stops.map((stop: any, idx: number) => {
                      const isPast = idx < truck.currentStopIndex;
                      const isCurrent = idx === truck.currentStopIndex && truck.status !== "completed";
                      
                      const itemsStr = stop.items.map((i: any) => `${i.plannedQty} ${i.productName}`).join(", ");
                      const icon = stop.stopType === "pickup" ? "📦" : stop.stopType === "delivery" ? "🏠" : "🏭";
                      const verb = stop.stopType === "pickup" ? "loaded" : "delivering";

                      return (
                        <div key={stop.id} className={`flex gap-4 items-start ${isPast ? 'opacity-60 grayscale' : ''}`}>
                          <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm
                              ${isPast ? 'bg-emerald-100 text-emerald-600' : isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-100' : 'bg-gray-100 text-gray-500'}
                            `}>
                              {isPast ? '✓' : isCurrent ? '🚛' : '⏳'}
                            </div>
                            {idx < truck.stops.length - 1 && (
                              <div className={`w-0.5 h-full min-h-[30px] my-1 ${isPast ? 'bg-emerald-200' : 'bg-gray-200'}`}></div>
                            )}
                          </div>
                          <div className="pt-1 pb-4">
                            <p className={`font-bold ${isCurrent ? 'text-blue-800' : 'text-gray-800'}`}>
                              {icon} {stop.entityName}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              — {verb} {itemsStr}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Product Status & Conservation */}
                <div className="p-6 bg-slate-50">
                  <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">Load Conservation</h4>
                  
                  <div className="space-y-4">
                    {/* Calculate per-truck product aggregates */}
                    {(() => {
                      const truckAgg: Record<string, { loaded: number; delivered: number; remaining: number }> = {};
                      
                      truck.stops.forEach((s: any, idx: number) => {
                        s.items.forEach((item: any) => {
                          if (!truckAgg[item.productName]) truckAgg[item.productName] = { loaded: 0, delivered: 0, remaining: 0 };
                          
                          const qty = item.confirmedQty !== undefined ? item.confirmedQty : item.plannedQty;
                          
                          if (s.stopType === "pickup" && idx < truck.currentStopIndex) truckAgg[item.productName].loaded += qty;
                          if (s.stopType === "delivery" && idx < truck.currentStopIndex) truckAgg[item.productName].delivered += qty;
                        });
                      });

                      return Object.entries(truckAgg).map(([name, metrics]) => {
                        const inTransit = metrics.loaded - metrics.delivered;
                        const isConserved = metrics.loaded === metrics.delivered + inTransit;
                        
                        return (
                          <div key={name} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                            <p className="font-bold text-gray-800 mb-2">{name}</p>
                            <div className="flex items-center justify-between text-xs font-semibold mb-3">
                              <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded">{metrics.loaded} Loaded</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{metrics.delivered} Delivered</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded">{inTransit} In Transit</span>
                            </div>
                            
                            <div className={`text-xs px-3 py-2 rounded-lg flex items-center justify-between ${isConserved ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                              <span>Conservation Check:</span>
                              <span className="font-bold">
                                {isConserved ? `${metrics.loaded} = ${metrics.delivered} + ${inTransit} ✓` : "Mismatch detected ⚠"}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
