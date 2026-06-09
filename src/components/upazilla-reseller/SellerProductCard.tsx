"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function SellerProductCard({
  product,
  onOrderClick,
}: {
  product: any;
  onOrderClick: (product: any) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(product.productCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col transition-all hover:shadow-md">
      {/* Top Banner for Product Details */}
      <div className="p-4 bg-gray-50 flex gap-4 border-b">
        <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
          {product.globalProduct?.imageUrl ? (
            <img
              src={product.globalProduct.imageUrl}
              alt={product.displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-gray-400 text-2xl font-bold">
              {product.displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">{product.displayName}</h4>
          <p className="text-sm text-gray-500">
            {product.globalProduct?.brand || "No Brand"} •{" "}
            {product.globalProduct?.category || "Uncategorized"}
          </p>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex justify-between items-center bg-gray-100 px-3 py-2 rounded-md border border-gray-200">
          <span className="text-sm text-gray-600 font-mono">
            Code: {product.productCode}
          </span>
          <button
            onClick={handleCopy}
            className="text-gray-500 hover:text-blue-600 transition-colors focus:outline-none"
            title="Copy Product Code"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex justify-between items-center text-sm mt-2">
          <span className="text-gray-600">Available Stock:</span>
          <span className={`font-medium ${product.stock <= 10 ? "text-orange-600" : "text-gray-900"}`}>
            {product.stock} units
          </span>
        </div>

        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Original Price:</span>
          <span className="font-semibold text-gray-900">BDT {product.price}</span>
        </div>
      </div>

      <div className="p-4 pt-0 mt-auto">
        <button
          onClick={() => onOrderClick(product)}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          Order Stock & Negotiate →
        </button>
      </div>
    </div>
  );
}
