"use client";

import { useEffect, useState, useRef } from "react";


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
        if (isMounted) setError((err instanceof Error ? err.message : String(err)) || "An error occurred");
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
                {["Product Name", "Brand", "Category", "Seller Store", "Seller Location", "Assigned Qty", "Routing Status", "Seller Price", "Seller Stock Remaining"].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[1, 2, 3].map((row) => (
                <tr key={row} className="animate-pulse">
                  {[...Array(9)].map((_, col) => (
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

  const Row = ({ index, style }: { index: number, style: React.CSSProperties }) => {
    const item = inventory[index];
    const sp = item.sellerProduct || {};
    const gp = sp.globalProduct || {};
    const seller = sp.seller || {};

    const productName = item.customName || gp.name || sp.customName || "Unknown Product";
    const brand = gp.brand || "—";
    const category = gp.category || "—";
    const storeName = seller.storeName || "Upazilla Reseller";
    const sellerLocation = seller.city && seller.upazilla ? `${seller.city} / ${seller.upazilla}` : "—";
    
    return (
      <div style={style} className="flex border-b border-gray-200 hover:bg-gray-50 transition-colors items-center bg-white px-6">
        <div className="w-1/4 pr-4 flex flex-col gap-1.5 justify-center py-2">
          <div className="flex items-center gap-3">
            {gp.imageUrl ? (
              <img src={gp.imageUrl} alt={productName} className="h-8 w-8 rounded-md object-cover border border-gray-200 bg-gray-50 flex-shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded-md border border-gray-200 bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
            )}
            <span className="text-sm font-medium text-gray-900 truncate">{productName}</span>
          </div>
          <div className="flex items-center">
            {item.customName ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                📦 Via Supply Chain
              </span>
            ) : item.sellerProductId ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                🏪 Direct Stock
              </span>
            ) : null}
          </div>
        </div>
        <div className="w-1/12 pr-4 text-sm text-gray-600 truncate">{brand}</div>
        <div className="w-1/12 pr-4 text-sm text-gray-600 truncate">{category}</div>
        <div className="w-1/6 pr-4 text-sm text-gray-900 font-medium truncate">{storeName}</div>
        <div className="w-1/6 pr-4 text-sm text-gray-600 truncate">{sellerLocation}</div>
        <div className="w-1/12 pr-4 text-sm font-medium">
          {item.quantity === 0 ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">No Stock</span>
          ) : item.quantity <= 3 ? (
            <span className="text-orange-600">{item.quantity}</span>
          ) : (
            <span className="text-green-600">{item.quantity}</span>
          )}
        </div>
        <div className="w-1/6 pr-4 text-sm">
          {item.isReserved ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800">Reserved for demand</span>
          ) : item.surplusQuantity > 0 ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800">Sent to district</span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-800 border border-gray-200">Pending routing</span>
          )}
        </div>
        <div className="w-1/12 pr-4 text-sm text-gray-900 font-semibold truncate">{sp.price ? formatPrice(sp.price) : "N/A"}</div>
        <div className="w-1/12 text-sm font-medium">
          {sp.stock === undefined ? (
            <span className="text-gray-400">N/A</span>
          ) : sp.stock === 0 ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800">Out</span>
          ) : sp.stock <= 5 ? (
            <span className="text-orange-600">{sp.stock}</span>
          ) : (
            <span className="text-gray-600">{sp.stock}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
      <div className="flex bg-gray-50 border-b border-gray-200 px-6 py-3">
        <div className="w-1/4 pr-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</div>
        <div className="w-1/12 pr-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</div>
        <div className="w-1/12 pr-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</div>
        <div className="w-1/6 pr-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller Store</div>
        <div className="w-1/6 pr-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</div>
        <div className="w-1/12 pr-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</div>
        <div className="w-1/6 pr-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Routing</div>
        <div className="w-1/12 pr-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</div>
        <div className="w-1/12 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rem. Stock</div>
      </div>
      <div className="flex-1 w-full relative overflow-y-auto">
        {inventory.map((item, index) => (
          <div key={item.id || index} style={{ height: 72 }}>
            <Row index={index} style={{}} />
          </div>
        ))}
      </div>
    </div>
  );
}
