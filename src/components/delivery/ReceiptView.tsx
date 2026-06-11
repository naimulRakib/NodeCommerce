'use client';

import { useState, useEffect } from 'react';

export default function ReceiptView({ orderId, onClose }: { orderId: string, onClose?: () => void }) {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        const res = await fetch(`/api/delivery/receipt/${orderId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load receipt');
        }
        const html = await res.text();
        setHtmlContent(html);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchReceipt();
  }, [orderId]);

  const handlePrint = () => {
    if (!htmlContent) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      // The HTML template includes a window.print() script on load
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Delivery Receipt',
          text: `Receipt for Order #${orderId}`,
          url: `/api/delivery/receipt/${orderId}`
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      alert('Sharing is not supported on this browser.');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Loading receipt...</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-500 text-4xl mb-4">⚠️</div>
        <p className="text-red-600 mb-4">{error}</p>
        {onClose && (
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg">Close</button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg max-w-2xl mx-auto overflow-hidden flex flex-col max-h-[90vh]">
      <div className="flex justify-between items-center p-4 border-b bg-gray-50">
        <h2 className="text-lg font-bold text-gray-800">Order Receipt</h2>
        <div className="flex gap-2">
          <button onClick={handleShare} className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md font-medium transition-colors flex items-center">
            <span className="mr-1">🔗</span> Share
          </button>
          <button onClick={handlePrint} className="px-3 py-1.5 text-sm bg-gray-800 text-white hover:bg-gray-900 rounded-md font-medium transition-colors flex items-center">
            <span className="mr-1">🖨️</span> PDF / Print
          </button>
          {onClose && (
            <button onClick={onClose} className="px-3 py-1.5 text-sm bg-gray-200 text-gray-800 hover:bg-gray-300 rounded-md font-medium transition-colors ml-2">
              Close
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-grow overflow-auto p-4 bg-gray-100">
        <div 
          className="bg-white mx-auto shadow-sm" 
          style={{ width: '100%', maxWidth: '800px', minHeight: '500px' }}
        >
          <iframe 
            srcDoc={htmlContent || ''} 
            title="Receipt"
            className="w-full h-full border-0 min-h-[600px]"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      </div>
    </div>
  );
}
