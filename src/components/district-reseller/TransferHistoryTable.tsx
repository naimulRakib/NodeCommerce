"use client";

import { useState, useEffect, useCallback } from "react";

interface Transfer {
  id: string;
  quantity: number;
  status: string;
  createdAt: string;
  upazillaReseller: {
    email: string;
    upazilla: string;
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
      const res = await fetch("/api/district-reseller/transfer");
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

  const pendingTransfers = transfers.filter((t) => t.status === "pending");
  const acceptedTransfers = transfers.filter((t) => t.status === "accepted");
  const rejectedTransfers = transfers.filter((t) => t.status === "rejected");

  const filteredTransfers = activeTab === "all" ? transfers : transfers.filter(t => t.status === activeTab);
  const displayedTransfers = filteredTransfers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = String(date.getDate()).padStart(2, "0");
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
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
    <div className="space-y-6">
      {/* Tabs */}
      <div className="w-full overflow-x-auto pb-2">
        <nav className="inline-flex space-x-2 p-1.5 bg-white/50 backdrop-blur-md rounded-2xl shadow-sm border border-white">
          <button
            onClick={() => { setActiveTab("all"); setCurrentPage(1); }}
            className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 ${
              activeTab === "all"
                ? "bg-white shadow-sm text-orange-600 border border-orange-100"
                : "text-slate-500 hover:bg-white/60 hover:text-slate-800 border border-transparent"
            }`}
          >
            All
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider ${activeTab === "all" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}>
              {transfers.length}
            </span>
          </button>
          <button
            onClick={() => { setActiveTab("pending"); setCurrentPage(1); }}
            className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 ${
              activeTab === "pending"
                ? "bg-white shadow-sm text-orange-600 border border-orange-100"
                : "text-slate-500 hover:bg-white/60 hover:text-slate-800 border border-transparent"
            }`}
          >
            Pending
            {pendingTransfers.length > 0 && (
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider ${activeTab === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-500"}`}>
                {pendingTransfers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab("accepted"); setCurrentPage(1); }}
            className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 ${
              activeTab === "accepted"
                ? "bg-white shadow-sm text-orange-600 border border-orange-100"
                : "text-slate-500 hover:bg-white/60 hover:text-slate-800 border border-transparent"
            }`}
          >
            Accepted
            {acceptedTransfers.length > 0 && (
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider ${activeTab === "accepted" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                {acceptedTransfers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab("rejected"); setCurrentPage(1); }}
            className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 ${
              activeTab === "rejected"
                ? "bg-white shadow-sm text-orange-600 border border-orange-100"
                : "text-slate-500 hover:bg-white/60 hover:text-slate-800 border border-transparent"
            }`}
          >
            Rejected
            {rejectedTransfers.length > 0 && (
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider ${activeTab === "rejected" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>
                {rejectedTransfers.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Table / Cards */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-200/50 border border-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse">
            <thead className="hidden md:table-header-group bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-gray-100">Product</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-gray-100">Sent To (Upazilla)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-gray-100">Quantity</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-gray-100">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-gray-100">Date Sent</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group p-4 md:p-0 space-y-4 md:space-y-0 bg-slate-50/30 md:bg-white divide-y-0 md:divide-y md:divide-gray-50">
              {loading ? (
                [1, 2, 3].map((skeleton) => (
                  <tr key={skeleton} className="block md:table-row animate-pulse bg-white md:bg-transparent rounded-2xl md:rounded-none p-4 md:p-0 shadow-sm md:shadow-none mb-4 md:mb-0 border border-gray-100 md:border-none">
                    <td className="block md:table-cell px-2 md:px-6 py-2 md:py-4"><div className="h-4 bg-slate-200 rounded w-3/4"></div></td>
                    <td className="block md:table-cell px-2 md:px-6 py-2 md:py-4"><div className="h-4 bg-slate-200 rounded w-1/2"></div></td>
                    <td className="block md:table-cell px-2 md:px-6 py-2 md:py-4"><div className="h-4 bg-slate-200 rounded w-12"></div></td>
                    <td className="block md:table-cell px-2 md:px-6 py-2 md:py-4"><div className="h-6 bg-slate-200 rounded-full w-20"></div></td>
                    <td className="block md:table-cell px-2 md:px-6 py-2 md:py-4"><div className="h-4 bg-slate-200 rounded w-1/3"></div></td>
                  </tr>
                ))
              ) : displayedTransfers.length === 0 ? (
                <tr className="block md:table-row">
                  <td colSpan={5} className="block md:table-cell px-6 py-16 text-center text-slate-500">
                    <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                      <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </div>
                    <p className="font-bold text-slate-800 text-lg">No transfers found.</p>
                  </td>
                </tr>
              ) : (
                displayedTransfers.map((transfer) => (
                  <tr key={transfer.id} className="block md:table-row bg-white md:bg-transparent rounded-2xl md:rounded-none shadow-sm md:shadow-none border border-gray-100 md:border-none p-4 md:p-0 hover:bg-slate-50/50 transition-colors mb-4 md:mb-0">
                    <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2 md:py-4 border-b border-gray-50 md:border-none">
                      <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product</span>
                      <span className="text-sm font-bold text-slate-800 max-w-[200px] md:max-w-xs truncate">
                        {transfer.stockItem?.productName || "[Item Deleted]"}
                      </span>
                    </td>
                    <td className="flex flex-col md:table-cell px-2 md:px-6 py-2 md:py-4 border-b border-gray-50 md:border-none">
                      <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sent To</span>
                      <span className="block font-bold text-slate-700">{transfer.upazillaReseller?.upazilla || "[Deleted Upazilla]"}</span>
                      <span className="block text-xs font-medium text-slate-500 mt-0.5">{transfer.upazillaReseller?.email || "[Deleted Reseller]"}</span>
                    </td>
                    <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2 md:py-4 border-b border-gray-50 md:border-none">
                      <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantity</span>
                      <span className="text-lg md:text-sm font-extrabold text-slate-800">
                        {transfer.quantity}
                      </span>
                    </td>
                    <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2 md:py-4 border-b border-gray-50 md:border-none whitespace-nowrap">
                      <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                      {transfer.status === "pending" && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest bg-yellow-500/10 text-yellow-700 border border-yellow-500/20 uppercase">
                          Pending
                        </span>
                      )}
                      {transfer.status === "accepted" && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest bg-green-500/10 text-green-700 border border-green-500/20 uppercase">
                          Accepted
                        </span>
                      )}
                      {transfer.status === "rejected" && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest bg-red-500/10 text-red-700 border border-red-500/20 uppercase">
                          Rejected
                        </span>
                      )}
                    </td>
                    <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2 md:py-4 whitespace-nowrap text-sm font-medium text-slate-400">
                      <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Sent</span>
                      {formatDate(transfer.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
