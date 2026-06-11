"use client";

import { useState } from "react";

export default function UpazillaUiPathPanel() {
  const [loadingType, setLoadingType] = useState<"incoming" | "outgoing" | null>(null);

  const generateManifest = async (type: "incoming" | "outgoing") => {
    setLoadingType(type);
    try {
      const payload = type === "incoming" 
        ? {
            shipmentId: "demo-incoming-001",
            phase: 1,
            fromName: "বুড়িচং ফ্রেশ ফার্ম (Seller)",
            toName: "উপজেলা হাব, বুড়িচং",
            totalQuantity: 1000,
            products: [{ name: "Premium Miniket Rice (50kg)", quantity: 1000 }],
            type: "arrival"
          }
        : {
            shipmentId: "demo-outgoing-001",
            phase: 2,
            fromName: "উপজেলা হাব, বুড়িচং",
            toName: "জেলা হাব, কুমিল্লা সদর",
            totalQuantity: 500,
            products: [{ name: "Premium Miniket Rice (50kg)", quantity: 500 }],
            type: "dispatch"
          };

      const res = await fetch("/api/uipath/delivery-manifest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `UiPath_Manifest_${type}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error("Failed to generate PDF");
      }
    } catch (err) {
      console.error(err);
      alert("Error generating PDF manifest.");
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
      <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-[#1e1b4b] text-white">
        <span className="text-2xl">🤖</span>
        <div>
          <h2 className="font-bold text-indigo-300">UiPath RPA Agent Demo</h2>
          <p className="text-xs text-slate-300">Automated Delivery Manifests</p>
        </div>
      </div>
      
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-lg p-4 flex flex-col gap-4 bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <span className="text-emerald-500">↓</span> Incoming Stock
            </h3>
            <p className="text-xs text-gray-500 mt-1">Generate manifest for stock arriving from local Seller (Burichang Fresh Farm).</p>
          </div>
          
          <button
            onClick={() => generateManifest("incoming")}
            disabled={loadingType !== null}
            className="mt-auto w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {loadingType === "incoming" ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <span>📄</span>
            )}
            {loadingType === "incoming" ? "Generating..." : "Generate Arrival PDF"}
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg p-4 flex flex-col gap-4 bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <span className="text-amber-500">↑</span> Outgoing Surplus
            </h3>
            <p className="text-xs text-gray-500 mt-1">Generate manifest for surplus stock dispatched to Cumilla Sadar District Hub.</p>
          </div>
          
          <button
            onClick={() => generateManifest("outgoing")}
            disabled={loadingType !== null}
            className="mt-auto w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {loadingType === "outgoing" ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <span>📄</span>
            )}
            {loadingType === "outgoing" ? "Generating..." : "Generate Dispatch PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
