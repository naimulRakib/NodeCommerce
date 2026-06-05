"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import InventoryQRModal from "@/components/seller/dashboard/InventoryQRModal";

const TABS = [
  { id: "all", label: "All" },
  { id: "approved", label: "Approved" },
  { id: "pending", label: "Pending" },
  { id: "rejected", label: "Rejected" },
];

function StatusBadge({ status }) {
  const styles = {
    approved: "bg-green-100 text-green-800 border-green-200",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
  };

  const key = status?.toLowerCase() || "pending";

  return (
    <span
      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border capitalize ${
        styles[key] || styles.pending
      }`}
    >
      {status || "pending"}
    </span>
  );
}

function productDisplayName(product) {
  return product.customName || product.globalProduct?.name || "Unnamed product";
}

function productBrandCategory(product) {
  const brand = product.globalProduct?.brand;
  const category = product.globalProduct?.category;
  if (brand && category) return `${brand} · ${category}`;
  return brand || category || "—";
}

function InlineNumberEdit({ value, onSave, onCancel, isSaving }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min="0"
        step="any"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-20 px-2 py-1 text-sm border border-orange-300 rounded focus:outline-none focus:border-orange-500"
        autoFocus
        disabled={isSaving}
      />
      <button
        type="button"
        onClick={() => onSave(draft)}
        disabled={isSaving}
        className="p-1 text-green-600 hover:bg-green-50 rounded"
        title="Save"
        aria-label="Save"
      >
        ✓
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={isSaving}
        className="p-1 text-gray-500 hover:bg-gray-100 rounded"
        title="Cancel"
        aria-label="Cancel"
      >
        ✕
      </button>
    </div>
  );
}

export default function InventoryTable() {
  const [products, setProducts] = useState<any[]>([]);
  const [sellerCode, setSellerCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [editingCell, setEditingCell] = useState<any>(null);
  const [savingId, setSavingId] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<any>(null);
  const [qrModal, setQrModal] = useState<any>(null);

  const loadInventory = useCallback(async (isMounted: boolean = true) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/seller/product");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load inventory");
      }
      if (isMounted) {
        setProducts(data.products ?? []);
        setSellerCode(data.sellerCode ?? "");
      }
    } catch (err) {
      if (isMounted) setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      if (isMounted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadInventory(isMounted);
    return () => { isMounted = false; };
  }, [loadInventory]);

  const counts = useMemo(() => {
    const c = { all: products.length, approved: 0, pending: 0, rejected: 0 };
    products.forEach((p) => {
      const s = (p.status || "pending").toLowerCase();
      if (s in c) c[s] += 1;
    });
    return c;
  }, [products]);

  const filtered = useMemo(() => {
    if (activeTab === "all") return products;
    return products.filter(
      (p) => (p.status || "pending").toLowerCase() === activeTab
    );
  }, [products, activeTab]);

  const patchProduct = async (id, payload) => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/seller/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Update failed");
      }
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? data.product : p))
      );
      setEditingCell(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (product) => {
    const name = productDisplayName(product);
    if (
      !window.confirm(
        `Delete "${name}" from your inventory? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingId(product.id);
    try {
      const res = await fetch(`/api/seller/inventory/${product.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Delete failed");
      }
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700 mb-3">{error}</p>
        <button
          type="button"
          onClick={() => loadInventory()}
          className="text-orange-600 font-medium hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 mt-10">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Inventory</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage stock, pricing, and QR codes for your products
        </p>
      </div>

      <div className="flex flex-wrap gap-2 px-6 pt-4 border-b border-gray-100 pb-3">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-full transition ${
              activeTab === tab.id
                ? "bg-orange-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {tab.label}
            <span
              className={`min-w-[1.25rem] px-1.5 py-0.5 text-xs rounded-full ${
                activeTab === tab.id
                  ? "bg-orange-600 text-white"
                  : "bg-white text-gray-600"
              }`}
            >
              {counts[tab.id]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-500 py-12 text-sm">
          No products in this category yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600 border-b border-gray-200">
                <th className="px-4 py-3 font-medium">Product Name</th>
                <th className="px-4 py-3 font-medium">Brand / Category</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Price (BDT)</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-center">QR</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((product) => {
                const isSaving = savingId === product.id;
                const isDeleting = deletingId === product.id;
                const stockKey = `${product.id}-stock`;
                const priceKey = `${product.id}-price`;

                return (
                  <tr key={product.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {productDisplayName(product)}
                      <span className="block text-xs text-gray-400 font-mono mt-0.5">
                        {product.productCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {productBrandCategory(product)}
                    </td>
                    <td className="px-4 py-3">
                      {editingCell === stockKey ? (
                        <InlineNumberEdit
                          value={product.stock}
                          isSaving={isSaving}
                          onCancel={() => setEditingCell(null)}
                          onSave={(val) =>
                            patchProduct(product.id, {
                              stock: parseInt(val, 10),
                            })
                          }
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingCell(stockKey)}
                          className="hover:text-orange-600 hover:underline"
                          title="Click to edit stock"
                        >
                          {product.stock}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingCell === priceKey ? (
                        <InlineNumberEdit
                          value={product.price}
                          isSaving={isSaving}
                          onCancel={() => setEditingCell(null)}
                          onSave={(val) =>
                            patchProduct(product.id, {
                              price: parseFloat(val),
                            })
                          }
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingCell(priceKey)}
                          className="hover:text-orange-600 hover:underline"
                          title="Click to edit price"
                        >
                          ৳{Number(product.price).toLocaleString("en-BD")}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={product.status} />
                        {product.status?.toLowerCase() === "rejected" &&
                          product.rejectionReason && (
                            <span
                              className="relative group cursor-help text-red-500"
                              title={product.rejectionReason}
                            >
                              ⓘ
                              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition z-10">
                                {product.rejectionReason}
                              </span>
                            </span>
                          )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setQrModal({
                            productName: productDisplayName(product),
                            productCode: product.productCode,
                            price: product.price,
                          })
                        }
                        className="p-2 rounded-md hover:bg-orange-50 text-orange-600"
                        title="View QR code"
                        aria-label={`QR code for ${productDisplayName(product)}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z"
                          />
                        </svg>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(product)}
                        disabled={isDeleting}
                        className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                      >
                        {isDeleting ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <InventoryQRModal
        isOpen={Boolean(qrModal)}
        onClose={() => setQrModal(null)}
        sellerCode={sellerCode}
        productCode={qrModal?.productCode}
        price={qrModal?.price}
        productName={qrModal?.productName}
      />
    </section>
  );
}
