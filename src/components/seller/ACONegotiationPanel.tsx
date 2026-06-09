"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

// Types
interface Negotiation {
  id: string;
  productName: string;
  productCode: string;
  requestedQty: number;
  sellerAskPrice: number;
  offeredPrice: number;
  systemPrice: number;
  status: string;
  expiresAt: string | null;
  createdAt: string;
}

export default function ACONegotiationPanel({ sellerId }: { sellerId?: string }) {
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const isMounted = useRef(false);

  // Counter State
  const [counterOpenFor, setCounterOpenFor] = useState<string | null>(null);
  const [counterPrice, setCounterPrice] = useState<number>(0);

  const fetchNegotiations = useCallback(async () => {
    try {
      // In a real app, the sellerId is derived from the session context on the server/client
      // Here we use a mock parameter or assume the endpoint picks it up from session
      const url = sellerId ? `/api/aco/negotiate?sellerId=${sellerId}` : "/api/aco/negotiate";
      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.json();
        if (isMounted.current) setError(errorData.error || "Failed to fetch negotiations");
        return;
      }
      const data = await res.json();
      if (isMounted.current) {
        setNegotiations(data.negotiations || []);
        setError(null);
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      if (isMounted.current) {
        setError(err.message || "Network error");
        setLoading(false);
      }
    }
  }, [sellerId]);

  useEffect(() => {
    isMounted.current = true;
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      if (!isMounted.current) return;
      await fetchNegotiations();
      if (!isMounted.current) return;
      timeoutId = setTimeout(poll, 15000); // 15s recursive poll
    };

    poll();

    return () => {
      isMounted.current = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [sellerId, fetchNegotiations]);

  const handleAction = async (id: string, action: "accept" | "reject" | "counter", customPrice?: number) => {
    if (action === "reject") {
      const confirm = window.confirm("If you reject, your stock will NOT be part of this ACO run. Are you sure?");
      if (!confirm) return;
    }

    setProcessingId(id);
    try {
      const res = await fetch(`/api/aco/negotiate/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, counterPrice: customPrice }),
      });
      if (res.ok) {
        await fetchNegotiations(); // Refresh
      } else {
        const error = await res.json();
        alert(`Failed: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (isMounted.current) setProcessingId(null);
    }
  };

  const calculateExpiry = (dateStr: string | null) => {
    if (!dateStr) return null;
    const diffMs = new Date(dateStr).getTime() - Date.now();
    if (diffMs <= 0) return "Expired";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const active = negotiations.filter((n) => ["pending", "countered"].includes(n.status));
  const historical = negotiations.filter((n) => !["pending", "countered"].includes(n.status));

  const earnings = negotiations
    .filter((n) => n.status === "accepted" || n.status === "auto_accepted")
    .reduce((sum, n) => sum + n.offeredPrice * n.requestedQty, 0);

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-20 bg-gray-200 rounded-xl"></div>
        <div className="h-40 bg-gray-200 rounded-xl"></div>
        <div className="h-40 bg-gray-200 rounded-xl"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-200 flex flex-col items-center justify-center text-center">
          <span className="text-3xl mb-2">⚠</span>
          <h3 className="font-bold text-lg mb-1">Failed to load negotiations</h3>
          <p className="text-sm">{error}</p>
          <button onClick={fetchNegotiations} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 font-sans">
      {/* Summary Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">ACO Negotiations</h2>
          <p className="text-slate-300 text-sm">
            Active: <span className="font-semibold text-white">{active.length}</span> | 
            Accepted: <span className="font-semibold text-white">{negotiations.filter(n => n.status.includes('accept')).length}</span> | 
            Rejected: <span className="font-semibold text-white">{negotiations.filter(n => n.status === 'rejected').length}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-emerald-400 font-medium uppercase tracking-wider mb-1">Est. ACO Earnings</p>
          <p className="text-3xl font-black">BDT {earnings.toLocaleString()}</p>
        </div>
      </div>

      {/* Active Negotiations */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Action Required</h3>
        {active.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No active requests.</p>
        ) : (
          active.map((neg) => {
            const isProcessing = processingId === neg.id;
            const diff = neg.sellerAskPrice - neg.offeredPrice;
            const percentage = Math.min(100, Math.max(0, (neg.offeredPrice / neg.sellerAskPrice) * 100));

            return (
              <div key={neg.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow relative overflow-hidden">
                {/* Status bar */}
                <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400"></div>

                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">{neg.productName}</h4>
                    <p className="font-mono text-xs text-gray-500 mt-1 bg-gray-100 inline-block px-2 py-0.5 rounded">
                      {neg.productCode}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Requested Quantity</p>
                    <p className="text-2xl font-bold text-blue-600">{neg.requestedQty}</p>
                  </div>
                </div>

                {neg.status === "pending" && (
                  <>
                    <div className="bg-slate-50 rounded-xl p-4 mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600 font-medium">Your Listed Price: BDT {neg.sellerAskPrice}</span>
                        <span className="text-emerald-600 font-bold">System Offering: BDT {neg.offeredPrice}</span>
                      </div>
                      
                      {/* Price Bar */}
                      <div className="relative h-2 bg-gray-200 rounded-full mb-2 overflow-hidden">
                        <div 
                          className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>

                      <div className="flex justify-between text-xs">
                        <span className={diff > 0 ? "text-red-500 font-medium" : "text-emerald-500 font-medium"}>
                          {diff > 0 ? `System offering is BDT ${diff.toFixed(2)} below your price` : "System offering meets your price"}
                        </span>
                        <span className="text-gray-500">Auto-accepted in {calculateExpiry(neg.expiresAt)}</span>
                      </div>
                    </div>

                    {counterOpenFor === neg.id ? (
                      <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200 flex items-center gap-4 mb-4">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-yellow-800 mb-1 uppercase tracking-wider">Your Counter Price (BDT)</label>
                          <input 
                            type="number" 
                            value={counterPrice} 
                            onChange={(e) => setCounterPrice(Number(e.target.value))}
                            className="w-full bg-white border border-yellow-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-500"
                          />
                        </div>
                        <div className="flex gap-2 mt-5">
                          <button 
                            onClick={() => handleAction(neg.id, "counter", counterPrice)}
                            disabled={isProcessing}
                            className="bg-yellow-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-yellow-600 disabled:opacity-50"
                          >
                            Send
                          </button>
                          <button 
                            onClick={() => setCounterOpenFor(null)}
                            className="text-gray-500 font-medium hover:text-gray-700 px-3 py-2"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button 
                          onClick={() => handleAction(neg.id, "accept")}
                          disabled={isProcessing}
                          className="flex-1 bg-emerald-500 text-white font-bold py-2.5 rounded-xl hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50"
                        >
                          Accept BDT {neg.offeredPrice}
                        </button>
                        <button 
                          onClick={() => { setCounterOpenFor(neg.id); setCounterPrice(neg.offeredPrice + 1); }}
                          disabled={isProcessing}
                          className="flex-1 bg-yellow-400 text-yellow-900 font-bold py-2.5 rounded-xl hover:bg-yellow-500 transition-colors shadow-sm disabled:opacity-50"
                        >
                          Counter Price
                        </button>
                        <button 
                          onClick={() => handleAction(neg.id, "reject")}
                          disabled={isProcessing}
                          className="px-6 border-2 border-red-200 text-red-600 font-bold py-2.5 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </>
                )}

                {neg.status === "countered" && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                    <p className="text-yellow-800 font-medium mb-1">Your counter: BDT {neg.offeredPrice}</p>
                    <p className="text-sm text-yellow-600 animate-pulse">Status: Awaiting review</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Historical */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800 border-b pb-2">History</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {historical.map(neg => (
            <div key={neg.id} className="bg-white rounded-xl border border-gray-100 p-4 opacity-75">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-gray-800">{neg.productName}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  neg.status.includes('accept') ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>
                  {neg.status === 'auto_accepted' ? 'Auto-Accepted' : 
                   neg.status === 'accepted' ? 'Accepted' : 'Rejected'}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {neg.requestedQty} units @ BDT {neg.offeredPrice}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
