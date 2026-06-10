"use client";

import React, { useState, useEffect, useRef } from "react";

export default function RealtimeActionCenter() {
  const [actions, setActions] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"urgent" | "all" | "done">("urgent");

  const isMounted = useRef(false);

  const fetchActions = async () => {
    try {
      const res = await fetch("/api/realtime/actions?unread=false");
      if (!res.ok) return;
      const data = await res.json();
      if (!isMounted.current) return;
      setActions(data.actions || []);
      setUnreadCount(data.unreadCount || 0);
      setUrgentCount(data.urgentCount || 0);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch actions", err);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      if (!isMounted.current) return;
      await fetchActions();
      if (!isMounted.current) return;
      timeoutId = setTimeout(poll, 15000);
    };

    poll();

    const handleOnline = () => {
      if (isMounted.current) fetchActions();
    };

    const handleVisibility = () => {
      if (!document.hidden && isMounted.current) fetchActions();
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted.current = false;
      controller.abort();
      clearTimeout(timeoutId);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const markAllRead = async () => {
    const unreadIds = actions.filter((a) => !a.isRead).map((a) => a.id);
    if (unreadIds.length === 0) return;
    
    // optimistic update
    setActions(actions.map(a => ({ ...a, isRead: true })));
    setUnreadCount(0);

    try {
      await fetch("/api/realtime/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds, markRead: true }),
      });
      fetchActions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCardClick = async (action: any) => {
    if (!action.isRead) {
      // Optimistic update
      setActions(actions.map(a => a.id === action.id ? { ...a, isRead: true } : a));
      setUnreadCount(prev => Math.max(0, prev - 1));

      try {
        await fetch(`/api/realtime/actions/${action.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead: true }),
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const getUrgentActions = () => actions.filter(a => a.requiresAction && !a.isActioned);
  const getDoneActions = () => actions.filter(a => a.isActioned);
  
  const displayedActions = 
    activeTab === "urgent" ? getUrgentActions() :
    activeTab === "done" ? getDoneActions() : actions;

  // RENDER BELL
  const renderBadge = () => {
    if (urgentCount > 0) {
      return (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
          {urgentCount}
        </span>
      );
    }
    if (unreadCount > 0) {
      return (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
          {unreadCount}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {renderBadge()}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[380px] bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Action Center</h3>
            <button 
              onClick={markAllRead}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Mark all read
            </button>
          </div>

          <div className="flex border-b border-gray-100">
            <button 
              className={`flex-1 py-2 text-sm font-medium ${activeTab === "urgent" ? "border-b-2 border-red-500 text-red-600" : "text-gray-500 hover:bg-gray-50"}`}
              onClick={() => setActiveTab("urgent")}
            >
              Urgent ({getUrgentActions().length})
            </button>
            <button 
              className={`flex-1 py-2 text-sm font-medium ${activeTab === "all" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:bg-gray-50"}`}
              onClick={() => setActiveTab("all")}
            >
              All ({actions.length})
            </button>
            <button 
              className={`flex-1 py-2 text-sm font-medium ${activeTab === "done" ? "border-b-2 border-gray-800 text-gray-800" : "text-gray-500 hover:bg-gray-50"}`}
              onClick={() => setActiveTab("done")}
            >
              Done ({getDoneActions().length})
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto p-2 space-y-2 bg-gray-50/50">
            {loading ? (
              <div className="p-4 text-center text-gray-400 text-sm">Loading actions...</div>
            ) : displayedActions.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No actions in this tab.</div>
            ) : (
              displayedActions.map((action) => (
                <div 
                  key={action.id}
                  onClick={() => handleCardClick(action)}
                  className={`
                    p-3 rounded-lg border text-sm cursor-pointer transition-all hover:shadow-md
                    ${!action.isRead ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-200'}
                    ${action.isActioned ? 'opacity-60 grayscale' : ''}
                    ${action.actionType === 'truck_arrived' && !action.isActioned ? 'animate-pulse border-red-500 bg-red-50' : ''}
                    ${action.actionType === 'negotiation_request' && !action.isActioned ? 'border-yellow-400 bg-yellow-50' : ''}
                    ${action.actionType === 'truck_arriving' ? 'border-orange-200' : ''}
                    ${action.actionType === 'phase3_approval' && !action.isActioned ? 'border-purple-300 bg-purple-50' : ''}
                  `}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={`font-semibold ${
                      action.actionType === 'truck_arrived' ? 'text-red-700' : 
                      action.actionType === 'negotiation_request' ? 'text-yellow-800' : 
                      'text-gray-800'
                    }`}>
                      {action.actionType === 'truck_arrived' ? "🚚 " : ""}{action.title}
                    </h4>
                    {!action.isRead && <span className="h-2 w-2 rounded-full bg-blue-500 mt-1 flex-shrink-0"></span>}
                  </div>
                  <p className="text-gray-600 text-xs mb-2 line-clamp-3 leading-relaxed">
                    {action.message}
                  </p>
                  
                  {action.expiresAt && !action.isActioned && (
                    <div className="mb-2">
                      {Date.now() > new Date(action.expiresAt).getTime() ? (
                        <div className="text-[10px] font-bold text-white bg-gray-500 inline-block px-2 py-0.5 rounded tracking-widest uppercase shadow-sm">
                          Expired — Truck moved on
                        </div>
                      ) : (
                        <div className="text-[10px] font-medium text-red-600 bg-red-100 inline-block px-2 py-0.5 rounded">
                          Expires: {new Date(action.expiresAt).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  )}

                  {!action.isActioned && action.requiresAction && !action.actionType.startsWith('interactive_truck_') && (
                    <div className="mt-2 flex justify-end">
                      {action.expiresAt && Date.now() > new Date(action.expiresAt).getTime() ? (
                        <button disabled className="text-xs font-semibold px-3 py-1.5 rounded bg-gray-200 text-gray-500 cursor-not-allowed">
                          Action Unavailable
                        </button>
                      ) : (
                        <button 
                          className={`text-xs font-semibold px-3 py-1.5 rounded shadow-sm ${
                            action.actionType === 'truck_arrived' ? 'bg-red-600 text-white hover:bg-red-700' :
                            action.actionType === 'negotiation_request' ? 'bg-yellow-500 text-white hover:bg-yellow-600' :
                            action.actionType === 'phase3_approval' ? 'bg-purple-600 text-white hover:bg-purple-700' :
                            'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {action.actionType === 'truck_arrived' ? "Confirm Now →" :
                           action.actionType === 'negotiation_request' ? "Respond Now →" :
                           action.actionType === 'phase3_approval' ? "Review & Approve →" :
                           "View Details →"}
                        </button>
                      )}
                    </div>
                  )}

                  {!action.isActioned && action.actionType.startsWith('interactive_truck_') && (
                    <InteractiveTruckAction action={action} onActioned={() => fetchActions()} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InteractiveTruckAction({ action, onActioned }: { action: any, onActioned: () => void }) {
  const [qty, setQty] = useState<string>(action.metadata?.maxQty?.toString() || "");
  const [loading, setLoading] = useState(false);

  const handleAction = async (type: "accept" | "partial" | "reject") => {
    setLoading(true);
    try {
      const { truckId, stopId } = action.metadata || {};
      if (!truckId || !stopId) throw new Error("Missing routing metadata");

      await fetch(`/api/aco/trucks/${truckId}/stops/${stopId}/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: type,
          acceptedQty: qty,
          notificationId: action.id
        })
      });
      onActioned();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const isDropoff = action.actionType === "interactive_truck_dropoff";

  return (
    <div className="mt-3 p-3 bg-white rounded border shadow-inner">
      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs font-semibold text-gray-700">
          {isDropoff ? "Amount to receive (units):" : "Amount to load (units):"}
        </label>
        <input 
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="border rounded px-2 py-1 w-20 text-sm font-bold"
          min="0"
          max={action.metadata?.maxQty}
        />
        <span className="text-xs text-gray-500">/ {action.metadata?.maxQty} max</span>
      </div>

      <div className="flex gap-2 justify-end">
        <button 
          disabled={loading}
          onClick={() => handleAction("reject")}
          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded"
        >
          {isDropoff ? "Reject All" : "Cannot Supply"}
        </button>
        <button 
          disabled={loading}
          onClick={() => handleAction("partial")}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"
        >
          {isDropoff ? "Accept Partial" : "Give Partial"}
        </button>
        <button 
          disabled={loading}
          onClick={() => handleAction("accept")}
          className="px-3 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded shadow-sm"
        >
          {isDropoff ? "Accept All" : "Give All"}
        </button>
      </div>
    </div>
  );
}
