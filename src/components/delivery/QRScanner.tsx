'use client';

import { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function QRScanner({ orderId, onComplete, onCancel }: { orderId: string, onComplete: () => void, onCancel: () => void }) {
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [successData, setSuccessData] = useState<{ message: string, receiptUrl: string } | null>(null);

  useEffect(() => {
    if (!scanning) return;

    // Use a robust div ID
    const scannerId = "qr-reader-container";
    
    const html5QrcodeScanner = new Html5QrcodeScanner(
      scannerId,
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    html5QrcodeScanner.render(
      (decodedText) => {
        // Stop scanning on success
        html5QrcodeScanner.clear().catch(console.error);
        setScanning(false);
        setResult(decodedText);
        handleConfirm(decodedText);
      },
      (err) => {
        // Ignored, continuous scanning
      }
    );

    return () => {
      try {
        html5QrcodeScanner.clear().catch(console.error);
      } catch (e) {}
    };
  }, [scanning]);

  const handleConfirm = async (qrString: string) => {
    setConfirming(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}/qr-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrString })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to confirm delivery');
      
      setSuccessData({
        message: 'Delivery confirmed!',
        receiptUrl: data.receiptUrl
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  };

  const handleTryAgain = () => {
    setError(null);
    setResult(null);
    setScanning(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Scan Delivery QR</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button>
        </div>

        <div className="p-6 text-center">
          {successData ? (
            <div className="py-8">
              <div className="text-6xl mb-4 text-green-500 animate-bounce">✅</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{successData.message}</h3>
              <p className="text-gray-500 mb-6">Receipt sent to customer.</p>
              
              <div className="space-y-3">
                <a 
                  href={successData.receiptUrl}
                  target="_blank"
                  className="block w-full py-3 bg-gray-100 hover:bg-gray-200 text-blue-600 font-bold rounded-lg transition-colors"
                >
                  📄 View Receipt
                </a>
                <button 
                  onClick={onComplete}
                  className="block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
                >
                  Continue Route
                </button>
              </div>
            </div>
          ) : error ? (
            <div className="py-8">
              <div className="text-6xl mb-4 text-red-500">❌</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Verification Failed</h3>
              <p className="text-red-600 bg-red-50 p-3 rounded-lg mb-6">{error}</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={onCancel}
                  className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleTryAgain}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <div>
              {scanning ? (
                <div id="qr-reader-container" className="mx-auto w-full max-w-[300px] overflow-hidden rounded-lg shadow-inner"></div>
              ) : confirming ? (
                <div className="py-12">
                  <div className="text-4xl animate-spin mb-4">⏳</div>
                  <p className="text-lg font-medium text-gray-600">Verifying signature...</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
