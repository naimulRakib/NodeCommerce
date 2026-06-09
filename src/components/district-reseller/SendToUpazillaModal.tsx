"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle, Send } from "lucide-react";

interface UpazillaReseller {
  id: string;
  upazilla: string;
  email: string;
}

interface DistrictStockItem {
  id: string;
  productName: string;
  quantity: number;
}

interface SendToUpazillaModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockItem: DistrictStockItem | null;
  surplusAvailable: number;
  onSuccess: (message: string) => void;
}

export default function SendToUpazillaModal({
  isOpen,
  onClose,
  stockItem,
  surplusAvailable,
  onSuccess
}: SendToUpazillaModalProps) {
  const [upazillaResellers, setUpazillaResellers] = useState<UpazillaReseller[]>([]);
  const [upazillaLoading, setUpazillaLoading] = useState(false);
  const [selectedUpazillaId, setSelectedUpazillaId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state
      setSelectedUpazillaId("");
      setQuantity("");
      setError(null);
      
      // Fetch upazillas
      let isMounted = true;
      const fetchUpazillas = async () => {
        setUpazillaLoading(true);
        try {
          // Assuming an endpoint exists or we fetch all upazillas for district
          const res = await fetch("/api/district-reseller/upazilla-resellers");
          if (!res.ok) throw new Error("Failed to load upazilla resellers");
          const data = await res.json();
          if (isMounted) setUpazillaResellers(data);
        } catch (err: any) {
          if (isMounted) setError(err.message);
        } finally {
          if (isMounted) setUpazillaLoading(false);
        }
      };
      fetchUpazillas();
      
      return () => { isMounted = false; };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose, submitting]);

  if (!isOpen || !stockItem) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > surplusAvailable) return;
    if (!selectedUpazillaId) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/district-reseller/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upazillaResellerId: selectedUpazillaId,
          sourceStockItemId: stockItem.id,
          quantity: qty
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) throw new Error("Not authorized to send to this upazilla.");
        throw new Error(data.error || "Failed to process transfer.");
      }

      const upazillaName = upazillaResellers.find(u => u.id === selectedUpazillaId)?.upazilla || "Upazilla";
      onSuccess(`✓ ${qty} units of ${stockItem.productName} sent to ${upazillaName}! Awaiting acceptance.`);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const parsedQty = parseInt(quantity) || 0;
  const isOverSurplus = parsedQty > surplusAvailable;
  const isFullSurplus = parsedQty === surplusAvailable && surplusAvailable > 0;
  const selectedUpazilla = upazillaResellers.find(u => u.id === selectedUpazillaId);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm transition-opacity"
      onClick={() => !submitting && onClose()}
    >
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" /> Send Stock to Upazilla
          </h2>
          <button 
            onClick={() => !submitting && onClose()} 
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* Read only info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <div className="text-sm text-gray-500 mb-1 font-medium">Product</div>
            <div className="text-lg font-bold text-gray-900 mb-3">{stockItem.productName}</div>
            <div className="flex justify-between items-center text-sm font-semibold">
              <span className="text-gray-600">Available to send:</span>
              <span className="text-green-600 font-bold text-base">{surplusAvailable} units</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Target Upazilla</label>
              <select
                value={selectedUpazillaId}
                onChange={(e) => setSelectedUpazillaId(e.target.value)}
                disabled={upazillaLoading || submitting}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:opacity-50"
              >
                <option value="">{upazillaLoading ? "Loading upazillas..." : "Select upazilla reseller..."}</option>
                {upazillaResellers.map(u => (
                  <option key={u.id} value={u.id}>{u.upazilla} — {u.email}</option>
                ))}
              </select>
              {upazillaResellers.length === 0 && !upazillaLoading && (
                <p className="text-sm text-gray-500 mt-1.5 italic">No upazilla resellers registered in your district yet.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex justify-between">
                Quantity to Send
                <span className="text-gray-400 font-normal">Max: {surplusAvailable} units</span>
              </label>
              <input
                type="number"
                min="1"
                max={surplusAvailable}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={submitting}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${isOverSurplus ? 'border-red-400 focus:border-red-500' : 'border-gray-300'}`}
                placeholder={`1 - ${surplusAvailable}`}
              />
              {isOverSurplus && (
                <p className="text-red-500 text-xs font-bold mt-1.5">Cannot exceed available surplus</p>
              )}
            </div>

            {/* Live Preview */}
            {parsedQty > 0 && !isOverSurplus && selectedUpazilla && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-blue-800">
                <Send className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
                <p className="text-sm font-medium">
                  Sending <span className="font-bold">{parsedQty}</span> × <span className="font-bold">{stockItem.productName}</span> to <span className="font-bold">{selectedUpazilla.upazilla}</span> reseller
                </p>
              </div>
            )}

            {/* Warning */}
            {isFullSurplus && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3 text-yellow-800">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-yellow-600" />
                <p className="text-sm font-medium">
                  ⚠ This will send all your surplus stock. Your hub will have 0 units available.
                </p>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedUpazillaId || parsedQty < 1 || isOverSurplus}
                className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                Send Stock
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
