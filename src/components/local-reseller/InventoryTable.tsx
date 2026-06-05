"use client";

import { useEffect, useState } from "react";

export default function InventoryTable() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchInventory = async () => {
      try {
        const res = await fetch("/api/local-reseller/inventory");
        if (!res.ok) throw new Error("Failed to load inventory");
        const data = await res.json();
        if (isMounted) {
          setInventory(data);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "An error occurred");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInventory();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", minimumFractionDigits: 0 }).format(price);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Product Name", "Brand", "Category", "Seller Store", "Seller Location", "Assigned Qty", "Seller Price", "Seller Stock Remaining"].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[1, 2, 3].map((row) => (
                <tr key={row} className="animate-pulse">
                  {[...Array(8)].map((_, col) => (
                    <td key={col} className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-8 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-orange-100 text-orange-700 font-medium rounded-md hover:bg-orange-200">
          Retry
        </button>
      </div>
    );
  }

  if (inventory.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900">No stock assigned yet.</h3>
        <p className="mt-1 text-sm text-gray-500 max-w-sm">
          Stock will appear here once assigned by a seller or admin.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller Store</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Qty</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller Stock Remaining</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {inventory.map((item) => {
              const sp = item.sellerProduct || {};
              const gp = sp.globalProduct || {};
              const seller = sp.seller || {};

              const productName = item.customName || gp.name || sp.customName || "Unknown Product";
              const brand = gp.brand || "—";
              const category = gp.category || "—";
              const storeName = seller.storeName || "Upazilla Reseller";
              const sellerLocation = seller.city && seller.upazilla ? `${seller.city} / ${seller.upazilla}` : "—";
              
              return (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-3">
                      {gp.imageUrl ? (
                        <img src={gp.imageUrl} alt={productName} className="h-10 w-10 rounded-md object-cover border border-gray-200 bg-gray-50" />
                      ) : (
                        <div className="h-10 w-10 rounded-md border border-gray-200 bg-gray-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                      )}
                      {productName}
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${brand === "—" ? "text-gray-400" : "text-gray-600"}`}>
                    {brand}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {storeName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {sellerLocation}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {item.quantity === 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        No Stock
                      </span>
                    ) : item.quantity <= 3 ? (
                      <span className="text-orange-600">{item.quantity}</span>
                    ) : (
                      <span className="text-green-600">{item.quantity}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                    {sp.price ? formatPrice(sp.price) : "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {sp.stock === undefined ? (
                      <span className="text-gray-400">N/A</span>
                    ) : sp.stock === 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Out of Stock
                      </span>
                    ) : sp.stock <= 5 ? (
                      <span className="text-orange-600">{sp.stock} left</span>
                    ) : (
                      <span className="text-gray-600">{sp.stock}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
