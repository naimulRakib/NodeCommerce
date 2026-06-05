"use client";

import { useState, useEffect, useCallback } from "react";

interface Transfer {
  id: string;
  quantity: number;
  status: string;
  createdAt: string;
  localReseller: {
    username: string;
  };
  stockItem: {
    productName: string;
  };
}

export default function TransferHistoryTable() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "accepted" | "rejected">("all");

  const fetchTransfers = useCallback(async (isMounted: boolean = true) => {
    try {
      const res = await fetch("/api/upazilla-reseller/transfer");
      if (!res.ok) throw new Error("Failed to load transfer history");
      const data = await res.json();
      if (isMounted) setTransfers(data);
    } catch (err: any) {
      if (isMounted) setError(err.message);
    } finally {
      if (isMounted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchTransfers(isMounted);
    return () => { isMounted = false; };
  }, [fetchTransfers]);

  const pendingCount = transfers.filter(t => t.status === "pending").length;
  const acceptedCount = transfers.filter(t => t.status === "accepted").length;
  const rejectedCount = transfers.filter(t => t.status === "rejected").length;

  const displayedTransfers = 
    activeTab === "all" ? transfers : 
    transfers.filter(t => t.status === activeTab);

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('default', { month: 'short' });
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  };

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-6 rounded-lg text-center border border-red-200">
        <p>{error}</p>
        <button onClick={() => fetchTransfers()} className="mt-4 px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200">Retry</button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Tabs */}
      <div className="border-b border-gray-200 px-6">
        <nav className="-mb-px flex space-x-6">
          <button
            onClick={() => setActiveTab("all")}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "all"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === "pending"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Pending
            {pendingCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'pending' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("accepted")}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === "accepted"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Accepted
            {acceptedCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'accepted' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>
                {acceptedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("rejected")}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === "rejected"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Rejected
            {rejectedCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'rejected' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>
                {rejectedCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sent To</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Sent</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              [1, 2, 3].map((skeleton) => (
                <tr key={skeleton} className="animate-pulse">
                  {[...Array(5)].map((_, i) => (
                    <td key={i} className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : displayedTransfers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  <p className="font-medium">No transfers sent yet.</p>
                </td>
              </tr>
            ) : (
              displayedTransfers.map((transfer) => (
                <tr key={transfer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {transfer.stockItem.productName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {transfer.localReseller.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    {transfer.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {transfer.status === "pending" && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        ⏳ Pending
                      </span>
                    )}
                    {transfer.status === "accepted" && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ Accepted
                      </span>
                    )}
                    {transfer.status === "rejected" && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        ✗ Rejected
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(transfer.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
