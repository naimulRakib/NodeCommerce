"use client";

import { useState } from "react";
import { X, AlertCircle } from "lucide-react";

export function StockOrderModal({
  product,
  seller,
  onClose,
  onSuccess,
}: {
  product: any;
  seller: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [quantity, setQuantity] = useState<number>(1);
  const [negotiatedPrice, setNegotiatedPrice] = useState<number>(product.price);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const originalTotal = quantity * product.price;
  const negotiatedTotal = quantity * negotiatedPrice;
  const savings = originalTotal - negotiatedTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (quantity > product.stock) {
      setError(`Only ${product.stock} units available.`);
      return;
    }

    if (negotiatedPrice < product.price * 0.5) {
      setError(`Negotiated price is too low. Minimum is BDT ${product.price * 0.5}.`);
      return;
    }

    if (negotiatedPrice > product.price * 2) {
      setError(`Negotiated price seems too high.`);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/upazilla-reseller/stock-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerProductId: product.id,
          requestedQuantity: quantity,
          negotiatedPrice,
          upazillaNote: note,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to place order.");
      }

      setSuccessMsg(`✓ Order sent to ${seller.storeName}! Waiting for seller response.`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">
            Order Stock from {seller.storeName}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 flex-1">
          {successMsg ? (
            <div className="flex flex-col items-center justify-center py-8 text-green-600">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8" />
              </div>
              <p className="text-lg font-medium text-center">{successMsg}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* Product Info Section */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <h3 className="font-semibold text-blue-900 mb-1">{product.displayName}</h3>
                <div className="flex justify-between text-sm text-blue-800 mb-1">
                  <span>Code: {product.productCode}</span>
                  <span>Category: {product.globalProduct?.category || "N/A"}</span>
                </div>
                <div className="flex justify-between text-sm mt-3 pt-3 border-t border-blue-200">
                  <span className="font-medium text-blue-900">Stock: {product.stock} units</span>
                  <span className="font-medium text-blue-900">Original Price: BDT {product.price}</span>
                </div>
              </div>

              {/* Order Details Section */}
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={product.stock}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Max available: {product.stock} units</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Price (BDT/unit)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={negotiatedPrice}
                    onChange={(e) => setNegotiatedPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  {negotiatedPrice < product.price && (
                    <p className="text-xs text-green-600 mt-1 font-medium">
                      BDT {product.price - negotiatedPrice} less than listed price
                    </p>
                  )}
                  {negotiatedPrice > product.price && (
                    <p className="text-xs text-orange-600 mt-1 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Above listed price — seller will likely reject
                    </p>
                  )}
                  {negotiatedPrice < product.price * 0.5 && (
                    <p className="text-xs text-red-600 mt-1 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Price is too low (minimum 50%)
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note to Seller (Optional)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Reason for price negotiation..."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {/* Live Summary */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Original Total:</span>
                  <span className="text-gray-500 line-through">BDT {originalTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center font-bold text-lg text-gray-900 border-t pt-2 mt-2 border-gray-200">
                  <span>Negotiated Total:</span>
                  <span>BDT {negotiatedTotal.toFixed(2)}</span>
                </div>
                {savings > 0 && (
                  <div className="flex justify-between items-center mt-1 text-sm text-green-600 font-medium">
                    <span>Your Savings:</span>
                    <span>BDT {savings.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Sending..." : "Send Order →"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// Needed because we use the Check icon above
function Check(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
