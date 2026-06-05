"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { buildQRString } from "@/lib/qr";

export default function InventoryQRModal({
  isOpen,
  onClose,
  sellerCode,
  productCode,
  price,
  productName,
}) {
  const titleId = useId();
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const encoded =
    sellerCode && productCode != null
      ? buildQRString(sellerCode, productCode, price)
      : "";

  const safeFileName = (productName || "product")
    .replace(/[^\w\-]+/g, "_")
    .slice(0, 80);

  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  const handleCopy = useCallback(async () => {
    if (!encoded) return;
    try {
      await navigator.clipboard.writeText(encoded);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [encoded]);

  const handleDownload = useCallback(() => {
    const svg = document.getElementById("inventory-qr-svg");
    if (!svg) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const img = new Image();
    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 512;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${safeFileName}_QR.png`;
        link.click();
        URL.revokeObjectURL(link.href);
      }, "image/png");
    };

    img.src = url;
  }, [safeFileName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close modal"
        onClick={onClose}
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm bg-white rounded-lg shadow-xl p-6 flex flex-col items-center gap-4"
      >
        <h2 id={titleId} className="text-lg font-semibold text-gray-900">
          Product QR — {productName || "Item"}
        </h2>

        {encoded ? (
          <>
            <div className="bg-white p-3 rounded border border-gray-200">
              <QRCodeSVG
                id="inventory-qr-svg"
                value={encoded}
                size={200}
                level="M"
                includeMargin
              />
            </div>

            <div className="w-full">
              <p className="text-xs text-gray-500 mb-1">Encoded string</p>
              <code className="block w-full text-xs font-mono bg-gray-100 border border-gray-200 rounded px-3 py-2 break-all text-gray-800">
                {encoded}
              </code>
            </div>

            <div className="flex flex-wrap gap-2 w-full justify-center">
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-md hover:bg-orange-600"
              >
                Download QR
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
              >
                {copied ? "Copied!" : "Copy Code"}
              </button>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-red-600 text-center">
            Missing seller or product code. Save your profile first.
          </p>
        )}
      </div>
    </div>
  );
}
