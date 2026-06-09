"use client";

import React, { useState, useEffect, useRef } from "react";
import { PlusCircle, Search, AlertCircle, CheckCircle2, Edit2, Trash2, X, Check } from "lucide-react";

interface LocalContributor {
  localResellerId: string;
  storeName: string;
  resellerCode: string;
  demandQuantity: number;
  fulfilledQuantity: number;
  status: string;
}

interface Demand {
  id: string;
  productName: string;
  demandQuantity: number;
  fulfilledQuantity: number;
  status: "pending" | "partially_fulfilled" | "fulfilled";
  notes: string | null;
  createdAt: string;
  localContributors: LocalContributor[];
  acoFulfilled: boolean;
}

export default function DemandPanel({ upazillaResellerId }: { upazillaResellerId: string }) {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [productName, setProductName] = useState("");
  const [demandQuantity, setDemandQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{ productName?: string; demandQuantity?: string; general?: string }>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" } | null>(null);

  // Product Code Search State
  const [productCode, setProductCode] = useState("");
  const [codeSearchStatus, setCodeSearchStatus] = useState<{ type: "searching" | "found" | "error", message?: string } | null>(null);
  const [foundSellerData, setFoundSellerData] = useState<{ sellerId: string; sellerProductId: string; price: number } | null>(null);

  // Expand/collapse local contributor breakdown
  const [expandedDemandId, setExpandedDemandId] = useState<string | null>(null);

  // Table row state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchDemands = async () => {
      try {
        const res = await fetch(`/api/demand/upazilla?upazillaResellerId=${upazillaResellerId}`);
        if (!res.ok) throw new Error("Failed to load demand data.");
        const data = await res.json();
        if (isMounted) {
          setDemands(data);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    if (upazillaResellerId) fetchDemands();
    
    return () => { isMounted = false; };
  }, [upazillaResellerId]);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (message: string, type: "success" | "info") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  };

  const handleProductCodeBlur = async () => {
    if (!productCode.trim()) {
      setCodeSearchStatus(null);
      setFoundSellerData(null);
      return;
    }
    setCodeSearchStatus({ type: "searching", message: "Searching..." });
    try {
      const res = await fetch(`/api/upazilla-reseller/sellers/products?productCode=${productCode.trim()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Not found");
      setProductName(data.productName);
      setFoundSellerData({
        sellerId: data.sellerId,
        sellerProductId: data.sellerProductId,
        price: data.price
      });
      setCodeSearchStatus({ type: "found", message: `✓ Found: ${data.productName} from ${data.storeName} (BDT ${data.price}/unit)` });
    } catch (err: any) {
      setCodeSearchStatus({ type: "error", message: err.message });
      setFoundSellerData(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    
    let hasError = false;
    const errors: { productName?: string; demandQuantity?: string; general?: string } = {};

    if (!productName.trim()) {
      errors.productName = "Product name is required";
      hasError = true;
    }
    
    const qty = parseInt(demandQuantity);
    if (isNaN(qty) || qty < 1 || qty > 100000) {
      errors.demandQuantity = "Quantity must be between 1 and 100,000";
      hasError = true;
    }

    if (hasError) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/demand/upazilla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upazillaResellerId,
          productName: productName.trim(),
          demandQuantity: qty,
          notes: notes.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save demand");
      }

      const isUpsert = demands.some(d => d.productName.toLowerCase() === productName.trim().toLowerCase());

      if (isUpsert) {
        setDemands(prev => prev.map(d => d.productName.toLowerCase() === productName.trim().toLowerCase() ? data.upazillaDemand : d));
      } else {
        setDemands(prev => [data.upazillaDemand, ...prev]);
      }

      // Auto-order feature if Option B was used
      if (productCode && codeSearchStatus?.type === "found" && foundSellerData) {
        const orderRes = await fetch("/api/upazilla-reseller/stock-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            upazillaResellerId,
            sellerId: foundSellerData.sellerId,
            sellerProductId: foundSellerData.sellerProductId,
            productCode: productCode.trim(),
            productName: productName.trim(),
            requestedQuantity: qty,
            originalPrice: foundSellerData.price,
            negotiatedPrice: foundSellerData.price,
            upazillaNote: notes.trim() || undefined
          })
        });

        if (!orderRes.ok) {
          const errData = await orderRes.json();
          showToast(`Demand saved, but failed to send automated order: ${errData.error}`, "info");
        } else {
          showToast(`Demand saved and order sent directly to Seller!`, "success");
        }
      } else {
        if (isUpsert) {
          showToast(`Demand for ${productName.trim()} updated to ${qty} units`, "info");
        } else {
          showToast(`Demand saved for ${productName.trim()}`, "success");
        }
      }

      setProductName("");
      setProductCode("");
      setCodeSearchStatus(null);
      setFoundSellerData(null);
      setDemandQuantity("");
      setNotes("");
    } catch (err: any) {
      setFormErrors({ general: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (demand: Demand) => {
    setEditingId(demand.id);
    setEditQty(demand.demandQuantity.toString());
    setEditNotes(demand.notes || "");
    setEditError(null);
    setDeletingId(null);
    setDeleteError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const handleEditSubmit = async (id: string) => {
    setEditError(null);
    const qty = parseInt(editQty);
    if (isNaN(qty) || qty < 1 || qty > 100000) {
      setEditError("Quantity must be between 1 and 100,000");
      return;
    }

    try {
      const res = await fetch(`/api/demand/upazilla/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demandQuantity: qty,
          notes: editNotes.trim() || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update demand");
      }

      setDemands(prev => prev.map(d => d.id === id ? data : d));
      setEditingId(null);
    } catch (err: any) {
      setEditError(err.message);
    }
  };

  const startDelete = (id: string) => {
    setDeletingId(id);
    setDeleteError(null);
    setEditingId(null);
  };

  const cancelDelete = () => {
    setDeletingId(null);
    setDeleteError(null);
  };

  const confirmDelete = async (id: string) => {
    setDeleteError(null);
    try {
      const res = await fetch(`/api/demand/upazilla/${id}?upazillaResellerId=${upazillaResellerId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete demand");
      }

      setDemands(prev => prev.filter(d => d.id !== id));
      setDeletingId(null);
    } catch (err: any) {
      setDeleteError(err.message);
    }
  };

  // Summary computations
  const totalDemands = demands.length;
  const totalUnits = demands.reduce((sum, d) => sum + (Number(d.demandQuantity) || 0), 0);
  const pendingCount = demands.filter(d => d.status === "pending").length;
  const fulfilledCount = demands.filter(d => d.status === "fulfilled").length;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-bold text-red-800">Failed to load demand data.</h3>
        </div>
        <p className="text-red-600 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-red-100 text-red-800 font-medium rounded-md hover:bg-red-200 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg font-medium text-white transition-opacity ${toast.type === "success" ? "bg-green-600" : "bg-blue-600"}`}>
          {toast.message}
        </div>
      )}

      {/* SECTION 1 - Add Demand Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <PlusCircle className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-bold text-gray-800">Enter Product Demand</h3>
        </div>
        <div className="p-6">
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-gray-700">Option A — By Product Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    maxLength={200}
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Rice, Premium Oil"
                    className={`w-full px-4 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${formErrors.productName ? 'border-red-400 focus:ring-red-200 focus:border-red-500' : 'border-gray-200'}`}
                  />
                  {formErrors.productName && <p className="text-red-500 text-xs font-medium mt-1">{formErrors.productName}</p>}
                </div>
                
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-gray-700">Option B — By Product Code (from Seller Stock)</label>
                  <input
                    type="text"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value)}
                    onBlur={handleProductCodeBlur}
                    placeholder="e.g. ABC123"
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                  {codeSearchStatus && (
                    <p className={`text-xs font-medium mt-1 ${codeSearchStatus.type === 'found' ? 'text-green-600' : codeSearchStatus.type === 'error' ? 'text-red-500' : 'text-blue-500'}`}>
                      {codeSearchStatus.message}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="md:col-span-4 space-y-1">
                <label className="block text-sm font-semibold text-gray-700">Demand Quantity <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={demandQuantity}
                  onChange={(e) => setDemandQuantity(e.target.value)}
                  placeholder="e.g. 100"
                  className={`w-full px-4 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${formErrors.demandQuantity ? 'border-red-400 focus:ring-red-200 focus:border-red-500' : 'border-gray-200'}`}
                />
                {formErrors.demandQuantity && <p className="text-red-500 text-xs font-medium mt-1">{formErrors.demandQuantity}</p>}
              </div>

              <div className="md:col-span-8 space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-semibold text-gray-700">Notes <span className="text-gray-400 font-normal">(Optional)</span></label>
                  <span className="text-xs text-gray-400">{notes.length}/500</span>
                </div>
                <textarea
                  maxLength={500}
                  rows={1}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special instructions or context..."
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                />
              </div>
            </div>

            {formErrors.general && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm border border-red-100 font-medium">
                <AlertCircle className="w-4 h-4" />
                {formErrors.general}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200 transition-all disabled:opacity-70 flex items-center gap-2"
              >
                {submitting ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : "Save Demand"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* SECTION 2 - Summary Bar */}
      {!loading && !error && demands.length > 0 && (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-4 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-4 font-medium text-sm">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Products</span>
              <span className="text-lg font-bold">{totalDemands}</span>
            </div>
            <div className="w-px h-8 bg-slate-700"></div>
            <div className="flex flex-col">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Total Units</span>
              <span className="text-lg font-bold">{totalUnits}</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Pending</span>
              <span className="text-lg font-bold text-yellow-400">{pendingCount}</span>
            </div>
            <div className="w-px h-8 bg-slate-700"></div>
            <div className="flex flex-col items-end">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Fulfilled</span>
              <span className="text-lg font-bold text-green-400">{fulfilledCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3 - Demands Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Demand</th>
                <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">ACO Delivered</th>
                <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Remaining</th>
                <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Local Resellers</th>
                <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                // Skeletons
                Array(4).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-6"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="py-4 px-6"><div className="h-4 bg-gray-200 rounded w-12 ml-auto"></div></td>
                    <td className="py-4 px-6"><div className="h-4 bg-gray-200 rounded w-12 ml-auto"></div></td>
                    <td className="py-4 px-6"><div className="h-4 bg-gray-200 rounded w-12 ml-auto"></div></td>
                    <td className="py-4 px-6"><div className="h-6 bg-gray-200 rounded-full w-20 mx-auto"></div></td>
                    <td className="py-4 px-6"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                    <td className="py-4 px-6"><div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div></td>
                  </tr>
                ))
              ) : demands.length === 0 ? (
                <tr key="empty-row">
                  <td colSpan={7} className="py-16 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100 shadow-sm">
                      <Search className="w-8 h-8 text-gray-400" />
                    </div>
                    <h4 className="text-gray-900 font-bold text-lg mb-1">No demand entered yet.</h4>
                    <p className="text-gray-500">Use the form above to enter your first demand.</p>
                  </td>
                </tr>
              ) : (
                demands.map((demand) => {
                  const remaining = Math.max(0, demand.demandQuantity - demand.fulfilledQuantity);
                  
                  // Edit Mode Row
                  if (editingId === demand.id) {
                    return (
                      <tr key={demand.id} className="bg-indigo-50/30">
                        <td className="py-4 px-6 font-bold text-gray-900 align-top pt-5">
                          {demand.productName}
                        </td>
                        <td colSpan={5} className="py-4 px-6 align-top">
                          <div className="flex flex-col gap-2 max-w-2xl">
                            <div className="flex items-start gap-4">
                              <div className="w-32">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Quantity</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={editQty}
                                  onChange={(e) => setEditQty(e.target.value)}
                                  className="w-full px-3 py-1.5 text-sm border border-indigo-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
                                <input
                                  type="text"
                                  value={editNotes}
                                  onChange={(e) => setEditNotes(e.target.value)}
                                  className="w-full px-3 py-1.5 text-sm border border-indigo-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                              </div>
                            </div>
                            {editError && <p className="text-red-600 text-sm font-medium mt-1">{editError}</p>}
                          </div>
                        </td>
                        <td className="py-4 px-6 align-top pt-8 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                              <X className="w-5 h-5" />
                            </button>
                            <button onClick={() => handleEditSubmit(demand.id)} className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded">
                              <Check className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // Normal Row
                  return (
                    <React.Fragment key={demand.id}>
                      <tr
                        className="hover:bg-gray-50 transition-colors group cursor-pointer"
                        onClick={() => setExpandedDemandId(prev => prev === demand.id ? null : demand.id)}
                      >
                        <td className="py-4 px-6">
                          <div className="font-bold text-gray-900">{demand.productName}</div>
                          {demand.localContributors.length > 0 && (
                            <div className="text-xs text-indigo-500 mt-0.5">
                              {demand.localContributors.length} local reseller{demand.localContributors.length > 1 ? 's' : ''} — click to view
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right font-medium text-gray-700">{demand.demandQuantity}</td>
                        <td className="py-4 px-6 text-right">
                          {demand.fulfilledQuantity > 0 ? (
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-green-600">{demand.fulfilledQuantity}</span>
                              <span className="text-[10px] text-green-500">via ACO</span>
                            </div>
                          ) : (
                            <span className="text-gray-300 font-medium">—</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          {remaining > 0 ? (
                            <span className="text-red-600 font-bold">{remaining}</span>
                          ) : (
                            <span className="text-green-500 font-bold">✓</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {demand.acoFulfilled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                              ✓ ACO Delivered
                            </span>
                          ) : demand.status === "partially_fulfilled" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
                              ◑ Partial
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                              ⏳ Awaiting ACO
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {demand.localContributors.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {demand.localContributors.slice(0, 2).map((c) => (
                                <span key={c.localResellerId} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  {c.storeName}
                                </span>
                              ))}
                              {demand.localContributors.length > 2 && (
                                <span className="text-[10px] text-gray-400">+{demand.localContributors.length - 2} more</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs italic">None yet</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {deletingId === demand.id ? (
                            <div className="flex flex-col items-end gap-2">
                              <div className="text-xs text-red-600 font-medium whitespace-nowrap">
                                Delete demand for {demand.productName}? This cannot be undone.
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); cancelDelete(); }} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium">Cancel</button>
                                <button onClick={(e) => { e.stopPropagation(); confirmDelete(demand.id); }} className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-medium">Confirm</button>
                              </div>
                              {deleteError && <div className="text-xs text-red-600 font-bold">{deleteError}</div>}
                            </div>
                          ) : (
                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); startEdit(demand); }}
                                className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 p-1.5 rounded-md transition"
                                title="Edit Demand"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); startDelete(demand.id); }}
                                className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-md transition"
                                title="Delete Demand"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {/* Expandable local reseller breakdown */}
                      {expandedDemandId === demand.id && demand.localContributors.length > 0 && (
                        <tr key={`${demand.id}-breakdown`}>
                          <td colSpan={7} className="px-6 pb-4 bg-indigo-50/40 border-b border-indigo-100">
                            <div className="text-xs font-bold text-indigo-700 mb-2 mt-1">Local Resellers contributing to this demand:</div>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-gray-400">
                                  <th className="py-1 pr-4">Store</th>
                                  <th className="py-1 pr-4">Code</th>
                                  <th className="py-1 pr-4 text-right">Qty Needed</th>
                                  <th className="py-1 pr-4 text-right">Qty Got</th>
                                  <th className="py-1">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-indigo-100">
                                {demand.localContributors.map((c) => (
                                  <tr key={c.localResellerId} className="text-gray-700">
                                    <td className="py-1.5 pr-4 font-semibold">{c.storeName}</td>
                                    <td className="py-1.5 pr-4 font-mono text-gray-400">{c.resellerCode}</td>
                                    <td className="py-1.5 pr-4 text-right font-bold">{c.demandQuantity}</td>
                                    <td className="py-1.5 pr-4 text-right">
                                      <span className={c.fulfilledQuantity > 0 ? 'text-green-600 font-bold' : 'text-gray-400'}>
                                        {c.fulfilledQuantity || '—'}
                                      </span>
                                    </td>
                                    <td className="py-1.5">
                                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        c.status === 'fulfilled' ? 'bg-green-100 text-green-700' :
                                        c.status === 'partially_fulfilled' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-gray-100 text-gray-600'
                                      }`}>
                                        {c.status === 'fulfilled' ? '✓ Got stock' :
                                         c.status === 'partially_fulfilled' ? 'Partial' :
                                         'Waiting'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                      {expandedDemandId === demand.id && demand.localContributors.length === 0 && (
                        <tr key={`${demand.id}-no-breakdown`}>
                          <td colSpan={7} className="px-6 py-3 bg-gray-50 text-xs text-gray-400 italic border-b">
                            No local resellers have submitted demand for this product yet. The upazilla reseller entered this demand manually.
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
