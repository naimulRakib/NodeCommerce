"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Checking product details...",
  "Verifying pricing against market rates...",
  "Scanning for policy compliance...",
  "Almost done...",
];

export default function AIVerificationScreen({
  productData,
  onApproved,
  onRejected,
  onRetry,
  onDiscard,
}) {
  const [status, setStatus] = useState("verifying"); // verifying, approved, rejected
  const [messageIndex, setMessageIndex] = useState(0);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    let interval;
    if (status === "verifying") {
      interval = setInterval(() => {
        setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    let isMounted = true;

    async function verifyProduct() {
      try {
        const res = await fetch("/api/seller/product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productData),
        });
        
        const data = await res.json();
        
        if (!isMounted) return;

        if (!res.ok) {
          throw new Error(data.error || "Failed to verify product.");
        }

        // Check if the API returned an explicit rejected status
        if (data.status === "rejected") {
          setStatus("rejected");
          setRejectionReason(data.reason || "Product did not meet marketplace standards.");
          onRejected(data.reason);
        } else {
          // Success (approved).
          // Our custom POST returns { success: true, product: SellerProduct }
          // Or the standard AI verify structure: { status: "approved", productCode, qrCode, sellerCode, price, productName }
          setStatus("approved");
          
          // Use setTimeout for the auto-transition effect
          setTimeout(() => {
            if (!isMounted) return;
            
            // Extract necessary fields depending on how /api/seller/product returned them
            let resultData;
            if (data.product) {
              resultData = {
                productCode: data.product.productCode,
                qrCode: data.product.qrCode,
                sellerCode: data.product.qrCode.split("_")[0], // assuming qrCode = sellerCode_productCode_price
                price: data.product.price,
                productName: data.product.customName || data.product.globalProduct?.name || "Product",
              };
            } else {
              resultData = {
                productCode: data.productCode,
                qrCode: data.qrCode,
                sellerCode: data.sellerCode,
                price: data.price,
                productName: data.productName || "Product",
              };
            }
            onApproved(resultData);
          }, 1500);
        }
      } catch (err) {
        if (!isMounted) return;
        setStatus("rejected");
        setRejectionReason(err.message || "An unexpected error occurred during verification.");
        onRejected(err.message);
      }
    }

    // Delay start slightly for UX
    const startTimer = setTimeout(() => {
      verifyProduct();
    }, 1000);

    return () => {
      isMounted = false;
      clearTimeout(startTimer);
    };
  }, [productData, onApproved, onRejected]);

  return (
    <div className="max-w-xl mx-auto bg-white rounded-md shadow-sm border border-gray-200 p-10 text-center min-h-[400px] flex flex-col items-center justify-center">
      {status === "verifying" && (
        <div className="flex flex-col items-center animate-in fade-in duration-500">
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-orange-500 border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-3xl">
              🤖
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying Product</h2>
          <p className="text-gray-600 animate-pulse">{MESSAGES[messageIndex]}</p>
          <div className="w-full max-w-xs mt-6 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 animate-[pulse_1s_ease-in-out_infinite] w-full origin-left scale-x-75"></div>
          </div>
        </div>
      )}

      {status === "approved" && (
        <div className="flex flex-col items-center animate-in zoom-in-95 duration-300">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Approved!</h2>
          <p className="text-gray-600">Your product has been added to your inventory.</p>
        </div>
      )}

      {status === "rejected" && (
        <div className="flex flex-col items-center w-full animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Product Not Approved</h2>
          <div className="w-full bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-8 text-sm">
            <p className="font-semibold mb-1">Rejection Reason:</p>
            <p>{rejectionReason}</p>
          </div>
          <div className="flex gap-4 w-full">
            <button
              onClick={onRetry}
              className="flex-1 bg-orange-500 text-white py-2 rounded-md font-semibold hover:bg-orange-600 transition"
            >
              Edit and Resubmit
            </button>
            <button
              onClick={onDiscard}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md font-semibold hover:bg-gray-50 transition"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
