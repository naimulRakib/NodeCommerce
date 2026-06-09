"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const DEMO_ITEMS = [
  { productName: "Rice (50kg bag)", brand: "Local", category: "Food", quantity: 100 },
  { productName: "Cooking Oil (5L)", brand: "Rupchanda", category: "Food", quantity: 80 },
  { productName: "Mobile Charger (Type-C)", brand: "Xiaomi", category: "Electronics", quantity: 50 },
  { productName: "Cotton T-Shirt", brand: "Arong", category: "Clothing", quantity: 60 },
  { productName: "Notebook A4 (200 pages)", brand: "Navana", category: "Stationery", quantity: 120 }
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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState("");

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (message: string, type: "success" | "error") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  };

  const fetchInventory = useCallback(async (isMounted: boolean = true) => {
    try {
      const res = await fetch("/api/upazilla-reseller/inventory");
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

      const res = await fetch("/api/upazilla-reseller/inventory", {
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
        const res = await fetch("/api/upazilla-reseller/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item)
        });
        if (res.ok) {
          addedItems.unshift(await res.json());
        }
      }
      setInventory((prev) => [...addedItems, ...prev]);
      showToast("Demo stock added!", "success");
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

      const res = await fetch(`/api/upazilla-reseller/inventory/${id}`, {
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
      // Optimistic update
      setInventory((prev) => prev.filter(item => item.id !== id));

      const res = await fetch(`/api/upazilla-reseller/inventory/${id}`, {
        method: "DELETE"
      });

      if (!res.ok) throw new Error("Failed to delete");
      showToast("Item deleted", "success");
    } catch (err) {
      showToast("Failed to delete item", "error");
      fetchInventory(); // Revert on error
    }
  };

  return (
    <div className="space-y-8 relative">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg font-medium text-white transition-opacity ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {toast.message}
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Add New Stock</h2>
          <button
            onClick={handleAddDemoStock}
            disabled={isAddingDemo}
            className="px-4 py-2 bg-indigo-50 text-indigo-600 text-sm font-medium rounded-md hover:bg-indigo-100 transition disabled:opacity-50 flex items-center gap-2"
          >
            {isAddingDemo && <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>}
            Add Demo Stock
          </button>
        </div>

        {formError && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-md text-sm">
            {formError}
          </div>
        )}

        <form onSubmit={handleAddStock} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Product Name *</label>
            <input
              type="text"
              required
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 sm:text-sm text-sm"
              placeholder="e.g. Rice 50kg"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Brand</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 sm:text-sm text-sm"
              placeholder="Optional"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 sm:text-sm text-sm"
              placeholder="Optional"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Quantity *</label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 sm:text-sm text-sm"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <button
              type="submit"
              disabled={isAdding}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 transition"
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">Current Inventory</h3>
            <span className="text-sm text-gray-500">{inventory.length} items</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                  <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  [1, 2, 3].map((skeleton) => (
                    <tr key={skeleton} className="animate-pulse">
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      </td>
                      <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      </td>
                      <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded w-1/2 ml-auto"></div>
                      </td>
                    </tr>
                  ))
                ) : inventory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                      </div>
                      <p className="font-medium text-gray-900">No stock yet.</p>
                      <p className="text-sm">Add items above.</p>
                    </td>
                  </tr>
                ) : (
                  inventory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 sm:px-6 py-4 text-sm font-medium text-gray-900 max-w-xs truncate">{item.productName}</td>
                      <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.brand || "—"}</td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.category || "—"}</td>
                      <td className="px-3 sm:px-6 py-4 text-sm whitespace-nowrap">
                        {editingId === item.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(e.target.value)}
                              className="w-16 sm:w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500"
                            />
                            <button onClick={() => saveEdit(item.id)} className="text-green-600 hover:text-green-800 p-1 bg-green-50 rounded flex-shrink-0" title="Save">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </button>
                            <button onClick={cancelEditing} className="text-gray-500 hover:text-gray-700 p-1 bg-gray-100 rounded flex-shrink-0" title="Cancel">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{item.quantity}</span>
                            {item.quantity === 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 flex-shrink-0">Empty</span>
                            )}
                            {item.quantity > 0 && item.quantity <= 10 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 flex-shrink-0">Low</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {editingId !== item.id && (
                          <div className="flex justify-end gap-2 sm:gap-3">
                            <button onClick={() => startEditing(item.id, item.quantity)} className="text-indigo-600 hover:text-indigo-900 flex-shrink-0" title="Edit Quantity">
                              <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700 flex-shrink-0" title="Delete Item">
                              <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
