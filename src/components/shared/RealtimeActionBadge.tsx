"use client";

import React, { useState, useEffect, useRef } from "react";

interface BadgeProps {
  userRole?: string;
  onClick?: () => void;
}

export default function RealtimeActionBadge({ userRole, onClick }: BadgeProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      if (!isMounted.current) return;
      try {
        const res = await fetch("/api/realtime/actions?unread=true", {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted.current) {
            setUnreadCount(data.unreadCount || 0);
            setUrgentCount(data.urgentCount || 0);
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch badge counts", err);
        }
      }

      if (isMounted.current) {
        // Poll every 30 seconds
        timeoutId = setTimeout(poll, 30000);
      }
    };

    poll();

    return () => {
      isMounted.current = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <button 
      onClick={onClick}
      className="relative p-2 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center"
      aria-label="Action Center"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      
      {urgentCount > 0 ? (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse shadow-sm">
          {urgentCount}
        </span>
      ) : unreadCount > 0 ? (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white shadow-sm">
          {unreadCount}
        </span>
      ) : null}
    </button>
  );
}
