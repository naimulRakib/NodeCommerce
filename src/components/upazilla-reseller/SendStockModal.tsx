"use client";

import { useState, useEffect } from "react";

interface UpazillaStockItem {
  id: string;
  productName: string;
  quantity: number;
}

interface SendStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  localReseller: { id: string; username: string; upazilla: string } | null;
  upazillaInventory: UpazillaStockItem[];
  onSuccess: () => void;
}

export default function SendStockModal({ isOpen, onClose, localReseller, upazillaInventory, onSuccess }: SendStockModalProps) {
  const [selectedStockId, setSelectedStockId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedStockId("");
      setQuantity("1");
      setError(null);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !localReseller) return null;

  const availableItems = upazillaInventory.filter(item => item.quantity > 0);
  const selectedItem = availableItems.find(item => item.id === selectedStockId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const qty = parseInt(quantity);
    if (!selectedStockId) {
      setError("Please select a product");
      return;
    }
    if (isNaN(qty) || qty < 1) {
      setError("Quantity must be at least 1");
      return;
    }
    if (selectedItem && qty > selectedItem.quantity) {
      setError(`Cannot send more than available (${selectedItem.quantity})`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/upazilla-reseller/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localResellerId: localReseller.id,
          stockItemId: selectedStockId,
          quantity: qty
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send stock");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={!loading ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden transform transition-all">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">
            Send Stock to {localReseller.username}
          </h3>
        </div>

        <div className="px-6 py-6">
          {error && (
            <div className="mb-4 bg-red-50 text-red-600 px-4 py-3 rounded-md text-sm border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Product
              </label>
              <select
                required
                value={selectedStockId}
                onChange={(e) => setSelectedStockId(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 sm:text-sm bg-white"
              >
                <option value="">-- Choose a product --</option>
                {availableItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.productName} (Available: {item.quantity})
                  </option>
                ))}
              </select>
              {availableItems.length === 0 && (
                <p className="mt-2 text-xs text-red-600">You have no available stock to send.</p>
              )}
            </div>

            {selectedItem && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity to Send
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedItem.quantity}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                />
                
                {/* Live Preview & Warnings */}
                <div className="mt-3 bg-gray-50 p-3 rounded border border-gray-200">
                  <p className="text-sm text-gray-700 font-medium">
                    Sending {parseInt(quantity) || 0} x {selectedItem.productName} to {localReseller.username}
                  </p>
                  {selectedItem.quantity < 5 && (
                    <p className="mt-1 text-xs font-semibold text-orange-600 flex items-center gap-1">
                      <span>⚠</span> Low stock on your end
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !selectedStockId || availableItems.length === 0}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Sending...
                  </>
                ) : (
                  "Send Stock"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
