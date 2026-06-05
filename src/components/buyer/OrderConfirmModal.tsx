"use client";

import { useEffect, useState } from "react";

export default function OrderConfirmModal({ orders, onClose, onViewOrders }: any) {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (countdown === 0) {
      onViewOrders();
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onViewOrders]);

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black bg-opacity-70 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center animate-fade-in-up">
        {/* Animated Checkmark */}
        <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-6">
          <svg className="h-12 w-12 text-green-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h2 className="text-2xl font-black text-gray-900 mb-2">Order Placed Successfully!</h2>
        <p className="text-gray-500 mb-6">
          Sellers have been notified and will confirm your order shortly.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-100 text-left">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Order Reference(s)</p>
          <div className="space-y-1">
            {orders.map((id: string) => (
              <div key={id} className="font-mono text-sm text-gray-800 bg-white px-2 py-1 border border-gray-200 rounded">
                #{id}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onViewOrders}
            className="w-full py-3 px-4 bg-orange-600 text-white rounded-md font-bold hover:bg-orange-700 transition shadow-sm"
          >
            View My Orders ({countdown}s)
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-white text-gray-700 border border-gray-300 rounded-md font-medium hover:bg-gray-50 transition"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}
