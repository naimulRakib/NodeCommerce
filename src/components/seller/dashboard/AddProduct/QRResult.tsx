"use client";

import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function QRResult({
  qrCode,
  productName,
  onAddAnother,
  onGoToInventory,
}) {
  const [copied, setCopied] = useState(false);
  const svgRef = useRef(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownload = () => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      // Add padding and white background
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 20, 20);
      
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `${productName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_QR.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="max-w-xl mx-auto bg-white rounded-md shadow-sm border border-gray-200 p-8 text-center animate-in zoom-in-95 duration-500 fade-in">
      <h2 className="text-xl font-bold text-gray-900 mb-6">{productName}</h2>
      
      <div className="flex flex-col items-center mb-6">
        <div className="p-4 border-2 border-dashed border-gray-200 rounded-lg inline-block bg-white shadow-sm mb-4">
          <QRCodeSVG
            value={qrCode}
            size={220}
            level="H"
            ref={svgRef}
            includeMargin={false}
          />
        </div>
        
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-md font-mono text-sm text-gray-700 overflow-hidden shadow-inner">
            <span className="truncate mr-2">{qrCode}</span>
            <button
              onClick={handleCopy}
              className="text-orange-600 hover:text-orange-700 font-semibold whitespace-nowrap focus:outline-none"
            >
              {copied ? "Copied! ✓" : "Copy"}
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
        <button
          onClick={handleDownload}
          className="bg-gray-900 text-white px-6 py-2 rounded-md font-semibold hover:bg-gray-800 transition shadow-sm flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download QR
        </button>
        <button
          onClick={onAddAnother}
          className="bg-orange-500 text-white px-6 py-2 rounded-md font-semibold hover:bg-orange-600 transition shadow-sm"
        >
          Add Another Product
        </button>
      </div>
      
      <div className="pt-6 border-t border-gray-100">
        <button
          onClick={onGoToInventory}
          className="text-orange-600 font-semibold hover:underline flex items-center justify-center gap-2 mx-auto"
        >
          View in Inventory →
        </button>
      </div>
    </div>
  );
}
