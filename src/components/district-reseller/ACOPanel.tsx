"use client";

import React, { useState, useEffect } from "react";
import { Truck, CheckCircle, Package } from "lucide-react";

export default function ACOPanel({ districtResellerId }: { districtResellerId: string }) {
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  const fetchAcoData = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const res = await fetch("/api/district-reseller/aco-shipments");
      if (res.ok) {
        const data = await res.json();
        setShipments(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAcoData();
    const interval = setInterval(() => fetchAcoData(true), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleApproveReject = async (oppId: string, action: "approve" | "reject") => {
    setLoadingActionId(oppId + action);
    try {
      const res = await fetch("/api/aco/approve-inter-district", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: oppId, action }),
      });
      if (res.ok) {
        fetchAcoData(true);
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to process approval action");
    } finally {
      setLoadingActionId(null);
    }
  };

  // Derive pending approvals where this district is involved
  const pendingApprovals = shipments.filter(
    (ship) => ship.phase === 3 && ship.status === "pending_approval"
  );

  // Other shipments (Phase 2, Phase 4, Phase 3 executed/expired)
  const otherShipments = shipments.filter(
    (ship) => !(ship.phase === 3 && ship.status === "pending_approval")
  );

  // Calculate statistics from the perspective of this district
  let unitsReceived = 0;
  let unitsSent = 0;
  let timesReceived = 0;
  let timesSent = 0;

  shipments.forEach((ship) => {
    if (ship.status === "dispatched" || ship.status === "delivered") {
      if (ship.toId === districtResellerId) {
        unitsReceived += ship.totalQuantity;
        timesReceived++;
      }
      if (ship.fromId === districtResellerId) {
        unitsSent += ship.totalQuantity;
        timesSent++;
      }
    }
  });

  if (loading && shipments.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      {/* SECTION 1: Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
          <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h2 className="text-lg font-bold text-amber-900">Pending Phase 3 Approvals</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingApprovals.map((opp) => {
              const isSource = opp.fromId === districtResellerId;
              const roleText = isSource ? "Sending Out" : "Receiving";
              const otherDistrict = isSource ? opp.toName : opp.fromName;
              const hasApprovedAlready = isSource ? opp.sourceApproved : opp.targetApproved;

              return (
                <div key={opp.id} className="border border-amber-200 rounded-xl p-4 bg-amber-50/30 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-600">{roleText}</span>
                      <h3 className="font-bold text-slate-800">Inter-District Transfer</h3>
                    </div>
                    <span className="bg-white px-2 py-1 rounded-md text-xs font-mono font-bold border border-amber-200 shadow-sm">
                      {opp.totalQuantity} units
                    </span>
                  </div>
                  
                  <div className="text-sm text-slate-600">
                    {isSource ? (
                      <>ACO proposes sending stock from your district to <span className="font-bold text-slate-800">{otherDistrict}</span>.</>
                    ) : (
                      <>ACO proposes routing surplus stock from <span className="font-bold text-slate-800">{otherDistrict}</span> to your district.</>
                    )}
                  </div>

                  <div className="bg-white/50 rounded-lg p-2 mt-2 space-y-1">
                    <div className="text-xs font-bold text-slate-500">LINE ITEMS:</div>
                    {opp.lineItems.map((li: any) => (
                      <div key={li.id} className="text-xs flex justify-between">
                        <span>{li.productName}</span>
                        <span className="font-mono">{li.allocatedQty} units</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-xs text-slate-500 flex justify-between">
                    <span>Score: {opp.overallAcoScore.toFixed(2)}</span>
                    <span>Distance: {opp.distanceKm.toFixed(1)} km</span>
                  </div>

                  <div className="mt-2 flex gap-3">
                    {hasApprovedAlready ? (
                      <div className="w-full text-center py-2 text-sm font-bold text-amber-600 bg-amber-100 rounded-lg">
                        You approved. Waiting for {otherDistrict}...
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleApproveReject(opp.id, "approve")}
                          disabled={loadingActionId !== null}
                          className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {loadingActionId === opp.id + "approve" ? "..." : "✓ Approve"}
                        </button>
                        <button
                          onClick={() => handleApproveReject(opp.id, "reject")}
                          disabled={loadingActionId !== null}
                          className="flex-1 bg-white border border-red-200 hover:bg-red-50 text-red-600 font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {loadingActionId === opp.id + "reject" ? "..." : "✗ Reject"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: Route Statistics */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <span className="text-xl">📊</span>
          <h2 className="text-lg font-bold text-slate-800">Your District's ACO Performance</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-100">
          <div className="p-6 text-center">
            <div className="text-3xl font-black text-emerald-600 mb-1">{timesReceived}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Times Routed Into</div>
          </div>
          <div className="p-6 text-center">
            <div className="text-3xl font-black text-emerald-600 mb-1">{unitsReceived}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Units Received</div>
          </div>
          <div className="p-6 text-center">
            <div className="text-3xl font-black text-purple-600 mb-1">{timesSent}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Times Routed Out</div>
          </div>
          <div className="p-6 text-center">
            <div className="text-3xl font-black text-purple-600 mb-1">{unitsSent}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Units Sent</div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Recent ACO Shipments */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <span className="text-xl">🐜</span>
          <h2 className="text-lg font-bold text-slate-800">Recent Shipments & Transfers</h2>
        </div>
        
        {otherShipments.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No recent ACO shipments affect this district.</div>
        ) : (
          <div className="p-6 flex flex-col gap-6">
            <div className="grid gap-4 lg:grid-cols-2">
              {otherShipments.map((ship) => {
                const phaseColor = 
                  ship.phase === 1 ? "bg-purple-100 text-purple-700 border-purple-200" :
                  ship.phase === 2 ? "bg-blue-100 text-blue-700 border-blue-200" :
                  ship.phase === 3 ? "bg-amber-100 text-amber-700 border-amber-200" :
                  ship.phase === 4 ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                  "bg-gray-100 text-gray-700 border-gray-200";

                return (
                  <div key={ship.id} className={`bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col relative ${phaseColor.split(' ')[2]}`}>
                    <div className="absolute top-0 right-0 p-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                        ship.status === "planned" || ship.status === "pending_approval" ? "bg-yellow-100 text-yellow-800" :
                        ship.status === "dispatched" ? "bg-blue-100 text-blue-800" :
                        ship.status === "expired" ? "bg-red-100 text-red-800" :
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
                        <div className="text-sm text-gray-500 mb-1">
                          {ship.fromId === districtResellerId ? "Destination" : "Source"}
                        </div>
                        <div className="font-bold text-lg text-gray-900">
                          {ship.fromId === districtResellerId ? ship.toName : ship.fromName}
                        </div>
                        <div className="text-sm text-gray-600 capitalize">
                          {ship.fromId === districtResellerId ? ship.toType.replace("_", " ") : ship.fromType.replace("_", " ")}
                        </div>
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
          </div>
        )}
      </div>

    </div>
  );
}
