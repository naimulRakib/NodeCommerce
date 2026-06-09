"use client";

import { useState, useEffect, useCallback } from "react";

interface Transfer {
  id: string;
  quantity: number;
  status: string;
  createdAt: string;
  localReseller: {
    username: string;
  } | null;
  stockItem: {
    productName: string;
  } | null;
}

export default function TransferHistoryTable() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "accepted" | "rejected">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const fetchTransfers = useCallback(async (isMounted: boolean = true) => {
    try {
      const res = await fetch("/api/upazilla-reseller/transfer");
      if (!res.ok) throw new Error("Failed to load transfer history");
      const data = await res.json();
      if (isMounted) setTransfers(data);
    } catch (err: any) {
      if (isMounted) setError((err instanceof Error ? err.message : String(err)));
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

  const filteredTransfers = activeTab === "all" ? transfers : transfers.filter(t => t.status === activeTab);
  const displayedTransfers = filteredTransfers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
      <div className="border-b border-gray-200 px-4 sm:px-6 overflow-x-auto">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => { setActiveTab("all"); setCurrentPage(1); }}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "all"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            All
          </button>
          <button
            onClick={() => { setActiveTab("pending"); setCurrentPage(1); }}
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
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
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
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
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
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
              <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sent To</th>
              <th className="px-3 sm:px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              [1, 2, 3].map((skeleton) => (
                <tr key={skeleton} className="animate-pulse">
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto"></div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </td>
                  <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </td>
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
                <tr key={transfer.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 sm:px-6 py-4 text-sm font-medium text-gray-900 max-w-xs truncate">
                    {transfer.stockItem?.productName || "[Item Deleted]"}
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {transfer.localReseller?.username || "[Deleted Reseller]"}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-center">
                    {transfer.quantity}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm">
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
                  <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                    {formatDate(transfer.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredTransfers.length > itemsPerPage && (
        <div className="px-4 py-3 border-t border-gray-200 bg-white flex items-center justify-between sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredTransfers.length)}</span> of <span className="font-medium">{filteredTransfers.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(Math.ceil(filteredTransfers.length / itemsPerPage), currentPage + 1))}
                  disabled={currentPage === Math.ceil(filteredTransfers.length / itemsPerPage)}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
