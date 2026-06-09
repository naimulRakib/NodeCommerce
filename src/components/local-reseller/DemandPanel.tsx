"use client";

import { useState, useEffect } from "react";

type SellerProduct = {
  id: string;
  customName: string;
  productCode: string;
  seller: {
    storeName: string;
    city: string;
    upazilla: string;
    sellerCode: string;
  };
};

type LocalDemand = {
  id: string;
  productName: string;
  productCode: string;
  demandQuantity: number;
  fulfilledQuantity: number;
  status: string;
  createdAt: string;
};

export default function DemandPanel() {
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [demands, setDemands] = useState<LocalDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, demRes] = await Promise.all([
        fetch("/api/local-reseller/products"),
        fetch("/api/local-reseller/demand")
      ]);
      
      if (prodRes.ok) setProducts(await prodRes.json());
      if (demRes.ok) setDemands(await demRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !quantity) return;
    
    setSubmitting(true);
    setError("");

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    try {
      const res = await fetch("/api/local-reseller/demand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productCode: product.productCode,
          productName: product.customName,
          demandQuantity: parseInt(quantity)
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit demand");
      }

      setQuantity("");
      setSelectedProduct("");
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading demand data...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Request New Stock</h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>Select a product from the global catalog and specify how many units you need.</p>
          </div>
          <form className="mt-5 sm:flex sm:items-center" onSubmit={handleSubmit}>
            <div className="w-full sm:max-w-xs">
              <label htmlFor="product" className="sr-only">Product</label>
              <select
                id="product"
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm rounded-md"
                required
              >
                <option value="">Select a product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.customName} ({p.productCode}) - {p.seller.storeName}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 sm:mt-0 sm:ml-3 w-full sm:max-w-[120px]">
              <label htmlFor="quantity" className="sr-only">Quantity</label>
              <input
                type="number"
                id="quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                placeholder="Qty"
                className="block w-full border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="mt-3 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Demand"}
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Your Demand Requests</h3>
        </div>
        <ul className="divide-y divide-gray-200">
          {demands.length === 0 ? (
            <li className="px-4 py-8 text-center text-gray-500 text-sm">
              You haven't requested any products yet.
            </li>
          ) : demands.map((demand) => (
            <li key={demand.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <p className="text-sm font-medium text-orange-600 truncate">{demand.productName}</p>
                  <p className="text-sm text-gray-500">Code: {demand.productCode}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end">
                    <p className="text-sm text-gray-900">Requested: {demand.demandQuantity}</p>
                    <p className="text-xs text-gray-500">Fulfilled: {demand.fulfilledQuantity}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                    ${demand.status === 'fulfilled' ? 'bg-green-100 text-green-800' : 
                      demand.status === 'partially_fulfilled' ? 'bg-blue-100 text-blue-800' : 
                      'bg-yellow-100 text-yellow-800'}`}>
                    {demand.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
