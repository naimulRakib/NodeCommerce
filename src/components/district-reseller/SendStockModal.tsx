"use client";

import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/layout/ToastProvider";

interface DistrictStockItem {
  id: string;
  productName: string;
  brand?: string;
  category?: string;
  quantity: number;
}

interface SendStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  upazillaReseller: {
    id: string;
    email: string;
    upazilla: string;
  };
  districtInventory: DistrictStockItem[];
}

export default function SendStockModal({
  isOpen,
  onClose,
  upazillaReseller,
  districtInventory,
}: SendStockModalProps) {
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  // Filter items that have quantity > 0
  const availableItems = districtInventory.filter((item) => item.quantity > 0);
  const selectedItem = availableItems.find((item) => item.id === selectedItemId);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!selectedItemId) throw new Error("Please select an item");
      const qtyNum = parseInt(quantity, 10);
      if (isNaN(qtyNum) || qtyNum < 1) throw new Error("Quantity must be at least 1");
      if (selectedItem && qtyNum > selectedItem.quantity) {
        throw new Error(`Quantity cannot exceed available stock (${selectedItem.quantity})`);
      }

      const res = await fetch("/api/district-reseller/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upazillaResellerId: upazillaReseller.id,
          stockItemId: selectedItemId,
          quantity: qtyNum,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to initiate transfer");
      }

      showToast(`Stock sent to ${upazillaReseller.upazilla}! Awaiting acceptance.`, "success");
      onClose();
    } catch (err: any) {
      if ((err instanceof Error ? err.message : String(err)) === "Failed to fetch") {
        setError("Network error, please try again");
      } else {
        setError((err instanceof Error ? err.message : String(err)));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 overflow-y-auto"
    >
      <div
        ref={modalRef}
        className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Send Stock to {upazillaReseller.upazilla} Reseller
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{upazillaReseller.email}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 text-red-600 border border-red-200 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Select Product
            </label>
            <select
              required
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                setQuantity("1"); // reset quantity to 1 on item change
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm bg-white"
            >
              <option value="">Select an Item</option>
              {availableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.productName} (Available: {item.quantity})
                </option>
              ))}
            </select>
          </div>

          {selectedItem && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                max={selectedItem.quantity}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm"
              />
              {selectedItem.quantity <= 20 && (
                <p className="text-xs text-orange-600 mt-1 font-medium flex items-center gap-1">
                  <span>⚠</span> Your stock is running low
                </p>
              )}
            </div>
          )}

          {selectedItem && quantity && parseInt(quantity, 10) >= 1 && (
            <div className="bg-orange-50/50 border border-orange-100 p-3 rounded-md text-xs text-gray-700">
              <span className="font-semibold text-orange-800">Preview:</span> Sending{" "}
              <span className="font-bold text-gray-900">{quantity}</span> ×{" "}
              <span className="font-bold text-gray-900">{selectedItem.productName}</span> to{" "}
              <span className="font-bold text-gray-900">{upazillaReseller.upazilla}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !selectedItemId}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {isLoading ? "Sending..." : "Send Stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
