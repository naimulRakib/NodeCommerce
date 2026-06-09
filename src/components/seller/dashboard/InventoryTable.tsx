"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const InventoryQRModal = dynamic(
  () => import("@/components/seller/dashboard/InventoryQRModal"),
  { ssr: false }
);

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

type EditProduct = {
  id: string;
  name: string;
  productCode: string;
  stock: number;
  price: number;
};

function EditProductModal({
  product,
  isSaving,
  error,
  onSave,
  onClose,
}: {
  product: EditProduct;
  isSaving: boolean;
  error: string | null;
  onSave: (next: { stock: number; price: number }) => void;
  onClose: () => void;
}) {
  const [stock, setStock] = useState(String(product.stock));
  const [price, setPrice] = useState(String(product.price));
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    setStock(String(product.stock));
    setPrice(String(product.price));
    setFieldError(null);
  }, [product.id, product.stock, product.price]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSaving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSaving, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const stockNum = Number(stock);
    const priceNum = Number(price);

    if (stock === "" || !Number.isFinite(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) {
      setFieldError("Stock must be a whole number 0 or greater.");
      return;
    }
    if (price === "" || !Number.isFinite(priceNum) || priceNum <= 0) {
      setFieldError("Base price must be greater than 0.");
      return;
    }

    setFieldError(null);
    onSave({ stock: stockNum, price: priceNum });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-product-title"
        className="w-full max-w-md bg-white rounded-lg shadow-xl border border-gray-200"
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 id="edit-product-title" className="text-lg font-semibold text-gray-900">
            Edit stock &amp; price
          </h3>
          <p className="text-sm text-gray-500 mt-1 truncate">
            {product.name}
            <span className="block text-xs text-gray-400 font-mono mt-0.5">
              {product.productCode}
            </span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="edit-stock" className="block text-sm font-medium text-gray-700 mb-1">
              Stock quantity
            </label>
            <input
              id="edit-stock"
              type="number"
              min="0"
              step="1"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              disabled={isSaving}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="edit-price" className="block text-sm font-medium text-gray-700 mb-1">
              Base price (BDT)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 font-medium">
                ৳
              </span>
              <input
                id="edit-price"
                type="number"
                min="0"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={isSaving}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          {(fieldError || error) && (
            <p className="text-sm text-red-600">{fieldError || error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-semibold text-white bg-orange-500 rounded-md hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving && (
                <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {isSaving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InventoryTable() {
  const [products, setProducts] = useState<any[]>([]);
  const [sellerCode, setSellerCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [editingProduct, setEditingProduct] = useState<EditProduct | null>(null);
  const [savingId, setSavingId] = useState<any>(null);
  const [editError, setEditError] = useState<string | null>(null);
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

  const patchProduct = async (
    id: string,
    payload: { stock?: number; price?: number }
  ) => {
    setSavingId(id);
    setEditError(null);
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
      setEditingProduct(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Update failed");
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
                  const isDeleting = deletingId === product.id;

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
                      <td className="px-4 py-3 text-gray-900">
                        {product.stock}
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        ৳{Number(product.price).toLocaleString("en-BD")}
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
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingProduct({
                                id: product.id,
                                name: productDisplayName(product),
                                productCode: product.productCode,
                                stock: Number(product.stock),
                                price: Number(product.price),
                              })
                            }
                            className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-800 text-sm font-medium"
                            title="Edit stock &amp; price"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(product)}
                            disabled={isDeleting}
                            className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                          >
                            {isDeleting ? "Deleting…" : "Delete"}
                          </button>
                        </div>
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

        {editingProduct && (
          <EditProductModal
            product={editingProduct}
            isSaving={savingId === editingProduct.id}
            error={editError}
            onClose={() => {
              if (savingId === editingProduct.id) return;
              setEditingProduct(null);
              setEditError(null);
            }}
            onSave={(next) => patchProduct(editingProduct.id, next)}
          />
        )}
      </section>
    );
  }