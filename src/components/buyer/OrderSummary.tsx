"use client";

import { useState } from "react";

export default function OrderSummary({ cartItems, deliveryAddress, isProfileIncomplete, onUpdateProfile, onConfirm, onBack }: any) {
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);

  // Group by seller
  const grouped = cartItems.reduce((acc: any, item: any) => {
    const seller = item.sellerProduct.seller.storeName || "Unknown Seller";
    if (!acc[seller]) acc[seller] = [];
    acc[seller].push(item);
    return acc;
  }, {});

  const grandTotal = cartItems.reduce((sum: number, item: any) => sum + (item.sellerProduct.price * item.quantity), 0);

  const handleConfirm = async () => {
    setPlacing(true);
    await onConfirm(note);
    setPlacing(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
        <h2 className="text-xl font-bold text-gray-900">Checkout</h2>
        <button onClick={onBack} className="text-sm font-medium text-gray-500 hover:text-gray-900">
          Back to Cart
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Address */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">Delivery Address</h3>
          <div className={`p-3 rounded-md border ${isProfileIncomplete ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
            <p className={`text-sm whitespace-pre-wrap ${isProfileIncomplete ? 'text-red-700 font-medium flex items-center gap-2' : 'text-gray-700'}`}>
              {isProfileIncomplete && <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
              {deliveryAddress}
            </p>
          </div>
        </div>

        {/* Order Items */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">Order Items</h3>
          <div className="space-y-4">
            {Object.keys(grouped).map(seller => {
              const subtotal = grouped[seller].reduce((sum: number, item: any) => sum + (item.sellerProduct.price * item.quantity), 0);
              return (
                <div key={seller} className="border border-gray-200 rounded-md overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">{seller}</span>
                    <span className="text-sm font-bold text-gray-900">৳{subtotal.toLocaleString("en-BD")}</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {grouped[seller].map((item: any) => (
                      <div key={item.id} className="p-3 flex justify-between items-center text-sm">
                        <div className="flex-1 pr-4">
                          <p className="text-gray-900 font-medium line-clamp-1">{item.sellerProduct.customName || item.sellerProduct.globalProduct?.name}</p>
                          <p className="text-gray-500 mt-0.5">{item.quantity} × ৳{item.sellerProduct.price.toLocaleString("en-BD")}</p>
                        </div>
                        <div className="font-medium text-gray-900">
                          ৳{(item.sellerProduct.price * item.quantity).toLocaleString("en-BD")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Buyer Note */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">Note to Seller (Optional)</h3>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Special delivery instructions..."
            className="w-full border-gray-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center mb-4">
          <span className="text-base text-gray-600 font-medium">Grand Total</span>
          <span className="text-2xl font-black text-orange-600">৳{grandTotal.toLocaleString("en-BD")}</span>
        </div>
        {isProfileIncomplete ? (
          <button
            onClick={onUpdateProfile}
            className="w-full py-3 px-4 bg-red-600 text-white rounded-md font-bold text-lg hover:bg-red-700 transition shadow-sm"
          >
            Update Delivery Address
          </button>
        ) : (
          <button
            disabled={placing}
            onClick={handleConfirm}
            className="w-full py-3 px-4 bg-orange-600 text-white rounded-md font-bold text-lg hover:bg-orange-700 transition shadow-sm disabled:opacity-50"
          >
            {placing ? "Placing Order..." : "Place Order →"}
          </button>
        )}
        <p className="text-xs text-center text-gray-500 mt-3">
          By placing this order you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
