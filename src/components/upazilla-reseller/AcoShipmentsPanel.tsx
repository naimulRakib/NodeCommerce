"use client";

import { useState, useEffect } from "react";
import { Package, Truck } from "lucide-react";

export function AcoShipmentsPanel() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/upazilla-reseller/aco-shipments");
      if (!res.ok) throw new Error("Failed to fetch ACO shipments");
      const data = await res.json();
      setShipments(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Incoming ACO Shipments</h2>
        <p className="text-gray-600">
          These are shipments automatically routed to your Upazilla by the Global ACO Pipeline.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-white border rounded-xl animate-pulse p-5">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
              <div className="h-6 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : shipments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Truck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">No incoming ACO shipments found.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {shipments.map((ship) => {
             const phaseColor = 
               ship.phase === 1 ? "bg-purple-100 text-purple-700 border-purple-200" :
               ship.phase === 2 ? "bg-blue-100 text-blue-700 border-blue-200" :
               ship.phase === 4 ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
               "bg-gray-100 text-gray-700 border-gray-200";

            return (
              <div key={ship.id} className={`bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col relative ${phaseColor.split(' ')[2]}`}>
                <div className="absolute top-0 right-0 p-3">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                    ship.status === "planned" ? "bg-yellow-100 text-yellow-800" :
                    ship.status === "dispatched" ? "bg-blue-100 text-blue-800" :
                    "bg-green-100 text-green-800"
                  }`}>
                    {ship.status}
                  </span>
                </div>
                <div className="p-5 flex-1 pt-8">
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`font-bold text-xs px-2 py-1 rounded ${phaseColor}`}>
                      Phase {ship.phase}
                    </span>
                    <span className="text-sm text-gray-500 font-mono">#{ship.id.slice(-8)}</span>
                  </div>

                  <div className="mb-4">
                    <div className="text-sm text-gray-500 mb-1">Source</div>
                    <div className="font-bold text-lg text-gray-900">{ship.fromName}</div>
                    <div className="text-sm text-gray-600 capitalize">{ship.fromType.replace("_", " ")}</div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 mb-4">
                    <div className="text-sm font-bold text-gray-700 mb-2 border-b pb-2">Line Items</div>
                    <div className="space-y-2">
                      {ship.lineItems.map((li: any) => (
                        <div key={li.id} className="flex justify-between items-center text-sm">
                          <span className="text-gray-800 font-medium">{li.productName}</span>
                          <span className="font-bold bg-white px-2 py-0.5 rounded border shadow-sm">
                            {li.allocatedQty} units
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Package className="w-4 h-4" />
                      <span>Total: <strong className="text-gray-900">{ship.totalQuantity} units</strong></span>
                    </div>
                    <div>
                      Score: {ship.overallAcoScore.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
