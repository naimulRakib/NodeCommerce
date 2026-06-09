"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/layout/ToastProvider";

const DEMO_ITEMS = [
  { productName: "Basmati Rice (50kg)", brand: "Local Mill", category: "Food", quantity: 500 },
  { productName: "Soybean Oil (5L)", brand: "Teer", category: "Food", quantity: 400 },
  { productName: "Mobile Charger (Type-C)", brand: "Xiaomi", category: "Electronics", quantity: 300 },
  { productName: "Cotton T-Shirt (Pack of 3)", brand: "Arong", category: "Clothing", quantity: 350 },
  { productName: "Notebook A4 (200 pages)", brand: "Navana", category: "Stationery", quantity: 600 },
  { productName: "Hand Sanitizer (500ml)", brand: "Dettol", category: "Healthcare", quantity: 250 },
  { productName: "LED Bulb (18W)", brand: "Philips", category: "Electronics", quantity: 200 },
  { productName: "Laundry Detergent (2kg)", brand: "Wheel", category: "Household", quantity: 450 }
];

export default function InventorySection() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Form state
  const [productName, setProductName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [formError, setFormError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingDemo, setIsAddingDemo] = useState(false);
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState("");

  const { showToast } = useToast();

  const fetchInventory = useCallback(async (isMounted: boolean = true) => {
    try {
      const res = await fetch("/api/district-reseller/inventory");
      if (!res.ok) throw new Error("Failed to load inventory");
      const data = await res.json();
      if (isMounted) setInventory(data);
    } catch (err: any) {
      if (isMounted) setError((err instanceof Error ? err.message : String(err)));
    } finally {
      if (isMounted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
     
    fetchInventory(isMounted);
    return () => { isMounted = false; };
  }, [fetchInventory]);

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsAdding(true);

    try {
      if (!productName.trim()) throw new Error("Product Name is required");
      if (parseInt(quantity) < 1) throw new Error("Quantity must be at least 1");

      const res = await fetch("/api/district-reseller/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, brand, category, quantity: parseInt(quantity) })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add item");
      }

      const newItem = await res.json();
      setInventory([newItem, ...inventory]);
      setProductName("");
      setBrand("");
      setCategory("");
      setQuantity("1");
      showToast("Item added successfully!", "success");
    } catch (err: any) {
      setFormError((err instanceof Error ? err.message : String(err)));
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddDemoStock = async () => {
    setIsAddingDemo(true);
    setFormError(null);
    try {
      const addedItems = [];
      for (const item of DEMO_ITEMS) {
        const res = await fetch("/api/district-reseller/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item)
        });
        if (res.ok) {
          addedItems.unshift(await res.json());
        }
      }
      setInventory((prev) => [...addedItems, ...prev]);
      showToast("Demo stock added! 8 items ready.", "success");
    } catch (err: any) {
      setFormError("Failed to add demo stock");
    } finally {
      setIsAddingDemo(false);
    }
  };

  const startEditing = (id: string, currentQty: number) => {
    setEditingId(id);
    setEditQuantity(currentQty.toString());
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditQuantity("");
  };

  const saveEdit = async (id: string) => {
    try {
      const qty = parseInt(editQuantity);
      if (isNaN(qty) || qty < 0) {
        showToast("Invalid quantity", "error");
        return;
      }

      // Optimistic update
      setInventory((prev) => prev.map(item => item.id === id ? { ...item, quantity: qty } : item));
      setEditingId(null);

      const res = await fetch(`/api/district-reseller/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty })
      });

      if (!res.ok) throw new Error("Failed to update");
      showToast("Quantity updated", "success");
    } catch (err) {
      showToast("Failed to update quantity", "error");
      fetchInventory(); // Revert on error
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;

    try {
      const res = await fetch(`/api/district-reseller/inventory/${id}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      // If delete succeeds, filter state
      setInventory((prev) => prev.filter(item => item.id !== id));
      showToast("Item deleted", "success");
    } catch (err: any) {
      showToast((err instanceof Error ? err.message : String(err)) || "Failed to delete item", "error");
    }
  };

  return (
    <div className="space-y-8 relative">
      <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-white relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-amber-500/10 rounded-full blur-xl"></div>
        
        <div className="flex justify-between items-center mb-6 relative z-10">
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Add New Stock</h2>
          <button
            onClick={handleAddDemoStock}
            disabled={isAddingDemo}
            className="px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-indigo-100 hover:shadow-sm transition-all duration-300 disabled:opacity-50 flex items-center gap-2"
          >
            {isAddingDemo && <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>}
            Demo Stock
          </button>
        </div>

        {formError && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-md text-sm">
            {formError}
          </div>
        )}

        <form onSubmit={handleAddStock} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end relative z-10">
          <div className="sm:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Product Name *</label>
            <input
              type="text"
              required
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/50 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 focus:bg-white sm:text-sm text-sm transition-all duration-300 shadow-inner"
              placeholder="e.g. Basmati Rice"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Brand</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/50 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 focus:bg-white sm:text-sm text-sm transition-all duration-300 shadow-inner"
              placeholder="Optional"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/50 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 focus:bg-white sm:text-sm text-sm transition-all duration-300 shadow-inner"
              placeholder="Optional"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Quantity *</label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/50 border border-slate-200/60 rounded-xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 focus:bg-white sm:text-sm text-sm transition-all duration-300 shadow-inner"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <button
              type="submit"
              disabled={isAdding}
              className="w-full py-2.5 px-4 rounded-xl shadow-lg shadow-orange-500/30 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:bg-slate-400 disabled:shadow-none transform hover:-translate-y-0.5 transition-all duration-300"
            >
              {isAdding ? "Adding..." : "Add to Inventory"}
            </button>
          </div>
        </form>
      </div>

      {error ? (
        <div className="bg-red-50 text-red-600 p-6 rounded-lg text-center border border-red-200">
          <p>{error}</p>
          <button onClick={() => fetchInventory()} className="mt-4 px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200">Retry</button>
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-200/50 border border-white overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">Current Inventory</h3>
            <span className="px-3 py-1 bg-white rounded-full text-xs font-bold text-orange-600 shadow-sm border border-orange-100">{inventory.length} items</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left border-collapse">

              <thead className="hidden md:table-header-group bg-slate-50/50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-gray-100">Product Name</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-gray-100">Brand</th>
                  <th className="hidden lg:table-cell px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-gray-100">Category</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-gray-100">Quantity</th>
                  <th className="hidden xl:table-cell px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-gray-100">Last Updated</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-gray-100">Actions</th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group p-4 md:p-0 space-y-4 md:space-y-0 bg-slate-50/30 md:bg-white divide-y-0 md:divide-y md:divide-gray-50">
                {loading ? (
                  [1, 2, 3].map((skeleton) => (
                    <tr key={skeleton} className="block md:table-row animate-pulse bg-white md:bg-transparent rounded-2xl md:rounded-none p-4 md:p-0 shadow-sm md:shadow-none mb-4 md:mb-0 border border-gray-100 md:border-none">
                      <td className="block md:table-cell px-2 md:px-6 py-2 md:py-4"><div className="h-4 bg-slate-200 rounded w-3/4"></div></td>
                      <td className="block md:table-cell px-2 md:px-6 py-2 md:py-4"><div className="h-4 bg-slate-200 rounded w-1/2"></div></td>
                      <td className="hidden lg:table-cell px-2 md:px-6 py-2 md:py-4"><div className="h-4 bg-slate-200 rounded w-1/3"></div></td>
                      <td className="block md:table-cell px-2 md:px-6 py-2 md:py-4"><div className="h-4 bg-slate-200 rounded w-1/4"></div></td>
                      <td className="hidden xl:table-cell px-2 md:px-6 py-2 md:py-4"><div className="h-4 bg-slate-200 rounded w-1/3"></div></td>
                      <td className="block md:table-cell px-2 md:px-6 py-2 md:py-4"><div className="h-4 bg-slate-200 rounded w-8 ml-auto"></div></td>
                    </tr>
                  ))
                ) : inventory.length === 0 ? (
                  <tr className="block md:table-row">
                    <td colSpan={6} className="block md:table-cell px-6 py-16 text-center text-slate-500">
                      <div className="mx-auto w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                      </div>
                      <p className="font-bold text-slate-800 text-lg">No stock available</p>
                      <p className="text-sm mt-1 text-slate-400">Add new items using the form above.</p>
                    </td>
                  </tr>
                ) : (
                  inventory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item: any) => (
                    <tr key={item.id} className="block md:table-row bg-white md:bg-transparent rounded-2xl md:rounded-none shadow-sm md:shadow-none border border-gray-100 md:border-none p-4 md:p-0 hover:bg-slate-50/50 transition-colors mb-4 md:mb-0 group">
                      <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2 md:py-4 border-b border-gray-50 md:border-none">
                        <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product Name</span>
                        <span className="text-sm font-bold text-slate-800 max-w-[200px] md:max-w-xs truncate">{item.productName}</span>
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2 md:py-4 border-b border-gray-50 md:border-none">
                        <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-wider">Brand</span>
                        <span className="text-sm text-slate-600 font-medium">{item.brand || "—"}</span>
                      </td>
                      <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">{item.category || "—"}</td>
                      <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-3 md:py-4 border-b border-gray-50 md:border-none">
                        <span className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantity</span>
                        {editingId === item.id ? (
                          <div className="flex items-center gap-1 justify-end md:justify-start">
                            <input
                              type="number"
                              min="0"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(e.target.value)}
                              className="w-16 sm:w-20 px-2 py-1 text-sm font-bold border border-orange-300 rounded focus:ring-orange-500 focus:border-orange-500 shadow-inner"
                            />
                            <button onClick={() => saveEdit(item.id)} className="text-white bg-green-500 hover:bg-green-600 p-1.5 rounded flex-shrink-0 shadow-sm" title="Save">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </button>
                            <button onClick={cancelEditing} className="text-white bg-slate-400 hover:bg-slate-500 p-1.5 rounded flex-shrink-0 shadow-sm" title="Cancel">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 cursor-pointer group-hover:scale-105 transition-transform origin-left justify-end md:justify-start" onClick={() => startEditing(item.id, item.quantity)}>
                            <span className="font-extrabold text-slate-800 text-base">{item.quantity}</span>
                            {item.quantity === 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-600 tracking-wider shadow-sm border border-red-200">EMPTY</span>
                            ) : item.quantity <= 20 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-600 tracking-wider shadow-sm border border-amber-200">LOW</span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="hidden xl:table-cell px-6 py-4 whitespace-nowrap text-sm text-slate-400 font-medium">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="flex justify-end md:table-cell px-2 md:px-6 py-3 md:py-4 text-right">
                        {editingId !== item.id && (
                          <div className="flex justify-end gap-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditing(item.id, item.quantity)} className="p-2 text-indigo-500 hover:text-white hover:bg-indigo-500 rounded-lg transition-colors shadow-sm bg-indigo-50 md:bg-transparent md:shadow-none border border-indigo-100 md:border-transparent" title="Edit Quantity">
                              <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button onClick={() => handleDelete(item.id)} className="p-2 text-red-500 hover:text-white hover:bg-red-500 rounded-lg transition-colors shadow-sm bg-red-50 md:bg-transparent md:shadow-none border border-red-100 md:border-transparent" title="Delete Item">
                              <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {inventory.length > itemsPerPage && (
            <div className="px-4 py-3 border-t border-gray-200 bg-white flex items-center justify-between sm:px-6">
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, inventory.length)}</span> of <span className="font-medium">{inventory.length}</span> results
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
                      onClick={() => setCurrentPage(Math.min(Math.ceil(inventory.length / itemsPerPage), currentPage + 1))}
                      disabled={currentPage === Math.ceil(inventory.length / itemsPerPage)}
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
      )}
    </div>
  );
}
