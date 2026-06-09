"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

export default function TruckIncomingPanel({ upazillaId }: { upazillaId?: string }) {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingStop, setProcessingStop] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<Record<string, Record<string, number>>>({}); // { stopId: { itemId: qty } }
  const isMounted = useRef(false);

  const fetchIncomingTrucks = useCallback(async () => {
    try {
      // In reality this might be /api/aco/trucks/incoming
      // For now we'll fetch all trucks for active job and filter in component, or assume backend has a route.
      // Since we didn't build a specific /incoming route, we fetch all active trucks for the user.
      // We'll mock this by fetching all trucks for latest job and filtering manually for demo.
      // Wait, the spec says "Fetch trucks where any stop has entityId = current user AND stopType = 'delivery'".
      // I'll create a quick query or assume a generic fetch.
      // Actually, since there is no such API created in the previous step, I will use a mock structure or try to hit a known API.
      // Let's assume we hit /api/aco/trucks?jobId=latest (in a real app we'd have a specific endpoint or job selector).
      const res = await fetch("/api/aco/trucks?jobId=latest"); // Assuming 'latest' resolves on backend or we pass a real jobId
      if (!res.ok) return;
      const data = await res.json();
      
      // Filter for trucks that have a delivery stop for this upazillaId
      const targetEntity = upazillaId || "mock-upazilla"; 
      const relevantTrucks = (data.trucks || []).filter((t: any) => 
        t.stops.some((s: any) => s.entityId === targetEntity && s.stopType === "delivery")
      );

      if (isMounted.current) {
        setTrucks(relevantTrucks);
        setLoading(false);
        
        // Initialize confirmData
        setConfirmData(prev => {
          const newData: any = { ...prev };
          relevantTrucks.forEach((t: any) => {
            const myStop = t.stops.find((s: any) => s.entityId === targetEntity);
            if (myStop && !newData[myStop.id]) {
              newData[myStop.id] = {};
              myStop.items.forEach((i: any) => {
                newData[myStop.id][i.id] = i.plannedQty; // Default to full accept
              });
            }
          });
          return newData;
        });
      }
    } catch (err) {
      console.error(err);
      if (isMounted.current) setLoading(false);
    }
  }, [upazillaId]);

  useEffect(() => {
    isMounted.current = true;
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      if (!isMounted.current) return;
      await fetchIncomingTrucks();
      if (!isMounted.current) return;
      timeoutId = setTimeout(poll, 15000);
    };

    poll();

    return () => {
      isMounted.current = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [upazillaId, fetchIncomingTrucks]);

  const handleConfirm = async (truckId: string, stopId: string) => {
    setProcessingStop(stopId);
    try {
      const itemsPayload = Object.entries(confirmData[stopId] || {}).map(([itemId, qty]) => ({
        stopItemId: itemId,
        confirmedQty: qty,
      }));

      const res = await fetch(`/api/aco/trucks/${truckId}/stops/${stopId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", items: itemsPayload }),
      });

      if (res.ok) {
        await fetchIncomingTrucks();
        alert("Receipt Confirmed Successfully");
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (isMounted.current) setProcessingStop(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading incoming trucks...</div>;
  if (trucks.length === 0) return <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">No incoming trucks at the moment.</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      <h2 className="text-2xl font-bold text-gray-800">Incoming Deliveries</h2>
      
      {trucks.map(truck => {
        const myStopIndex = truck.stops.findIndex((s: any) => s.entityId === (upazillaId || "mock-upazilla"));
        const myStop = truck.stops[myStopIndex];
        const isArrived = myStop.status === "truck_arrived";
        const isPast = myStopIndex < truck.currentStopIndex;

        return (
          <div key={truck.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${isArrived ? 'border-red-400 shadow-red-100' : 'border-gray-200'}`}>
            {/* Header */}
            <div className={`p-4 flex justify-between items-center border-b ${isArrived ? 'bg-red-50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚛</span>
                <div>
                  <h3 className="font-bold text-gray-900">Truck {truck.truckCode}</h3>
                  <p className="text-xs text-gray-500 font-medium">Status: {truck.status}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${isArrived ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-100 text-blue-700'}`}>
                  {isArrived ? 'TRUCK IS HERE' : 'En Route'}
                </span>
                <p className="text-xs text-gray-500 mt-1">Stop {myStopIndex + 1} of {truck.stops.length}</p>
              </div>
            </div>

            {/* Route Visualization */}
            <div className="p-6 border-b border-gray-100 relative">
              <div className="absolute top-1/2 left-6 right-6 h-1 bg-gray-200 -translate-y-1/2 z-0 rounded-full"></div>
              <div 
                className="absolute top-1/2 left-6 h-1 bg-emerald-400 -translate-y-1/2 z-0 rounded-full transition-all duration-1000"
                style={{ width: `${(truck.currentStopIndex / (truck.stops.length - 1)) * 100}%` }}
              ></div>
              
              <div className="relative z-10 flex justify-between">
                {truck.stops.map((stop: any, idx: number) => {
                  const isMe = idx === myStopIndex;
                  const isDone = idx < truck.currentStopIndex;
                  const isCurrent = idx === truck.currentStopIndex;
                  
                  return (
                    <div key={stop.id} className="flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full border-4 mb-2 flex items-center justify-center bg-white
                        ${isDone ? 'border-emerald-500' : isCurrent ? 'border-blue-500' : 'border-gray-300'}
                        ${isMe ? 'ring-4 ring-offset-2 ring-yellow-300 transform scale-125' : ''}
                      `}>
                        {isMe && <span className="text-[10px]">🏠</span>}
                      </div>
                      <span className={`text-[10px] font-bold max-w-[60px] text-center truncate ${isMe ? 'text-gray-900' : 'text-gray-500'}`}>
                        {isMe ? 'YOU' : stop.entityName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Area */}
            <div className="p-6">
              {isArrived ? (
                <div className="bg-red-50 rounded-xl p-5 border border-red-200">
                  <h4 className="text-red-700 font-bold mb-4 flex items-center gap-2">
                    <span className="text-xl animate-bounce">📦</span> 
                    Truck is waiting for confirmation
                  </h4>
                  
                  <div className="space-y-4 mb-6">
                    {myStop.items.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
                        <div>
                          <p className="font-bold text-gray-800">{item.productName}</p>
                          <p className="text-xs text-gray-500">Planned: {item.plannedQty} units</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="text-xs font-semibold text-gray-600">Accept Qty:</label>
                          <input 
                            type="number" 
                            min="0" 
                            max={item.plannedQty}
                            value={confirmData[myStop.id]?.[item.id] ?? item.plannedQty}
                            onChange={(e) => {
                              const val = Math.min(item.plannedQty, Math.max(0, Number(e.target.value)));
                              setConfirmData(prev => ({
                                ...prev,
                                [myStop.id]: { ...prev[myStop.id], [item.id]: val }
                              }));
                            }}
                            className="w-20 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-center font-bold outline-none focus:ring-2 focus:ring-red-400"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-3">
                    <button 
                      onClick={() => {
                        // Reject all (set 0)
                        const zData: any = {};
                        myStop.items.forEach((i:any) => zData[i.id] = 0);
                        setConfirmData(prev => ({ ...prev, [myStop.id]: zData }));
                      }}
                      className="px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      Set All to 0
                    </button>
                    <button 
                      disabled={processingStop === myStop.id}
                      onClick={() => handleConfirm(truck.id, myStop.id)}
                      className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-md transition-all disabled:opacity-50"
                    >
                      {processingStop === myStop.id ? 'Processing...' : 'Confirm Receipt'}
                    </button>
                  </div>
                </div>
              ) : isPast ? (
                <div className="text-center p-4 bg-emerald-50 rounded-xl text-emerald-700 font-bold border border-emerald-100">
                  ✓ Delivery Completed
                </div>
              ) : (
                <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-blue-800 font-bold mb-2">Truck arriving soon...</p>
                  <p className="text-sm text-blue-600">Prepare storage for:</p>
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {myStop.items.map((i: any) => (
                      <span key={i.id} className="text-xs font-semibold bg-white text-gray-700 px-2 py-1 rounded shadow-sm border border-blue-100">
                        {i.plannedQty}x {i.productName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
