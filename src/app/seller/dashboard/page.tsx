"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabase";
import InventoryTable from "@/components/seller/dashboard/InventoryTable";
import ProfileSection from "@/components/seller/dashboard/ProfileSection";
import ProductSearch from "@/components/seller/dashboard/AddProduct/ProductSearch";
import CustomProductForm from "@/components/seller/dashboard/AddProduct/CustomProductForm";
import dynamic from "next/dynamic";

const QRResult = dynamic(
  () => import("@/components/seller/dashboard/AddProduct/QRResult"),
  { ssr: false }
);
import OrdersTab from "@/components/seller/dashboard/OrdersTab";
import { StockOrdersPanel } from "@/components/seller/StockOrdersPanel";
import { AcoShipmentsPanel } from "@/components/seller/AcoShipmentsPanel";
import { useLanguage } from "@/contexts/LanguageContext";
import { MetricCard } from "@/components/ui/MetricCard";

export default function SellerDashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("inventory");
  const [sellerProfile, setSellerProfile] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [stats, setStats] = useState({ totalRevenue: 0, totalOrders: 0, pendingCount: 0, inventory: 0 });

  // Add Product Flow State
  const [currentStage, setCurrentStage] = useState("A");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [formData, setFormData] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [existingStockPrice, setExistingStockPrice] = useState<any>({ stock: "", price: "" });
  const [existingErrors, setExistingErrors] = useState<any>({});

  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      try {
        const { data } = await supabaseClient.auth.getUser();
        if (!data.user) {
          router.replace("/seller");
          return;
        }
        
        const res = await fetch("/api/seller/profile");
        if (!res.ok) {
          router.replace("/seller");
          return;
        }
        const profileData = await res.json();
        if (isMounted) setSellerProfile(profileData.profile);

        // Fetch stats in background
        fetch("/api/seller/stats")
          .then(async r => {
            if (r.ok) {
              const data = await r.json();
              if (isMounted) setStats(data);
            }
          })
          .catch(() => {});
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoadingAuth(false);
      }
    }
    checkAuth();
    return () => { isMounted = false; };
  }, [router]);

  const resetAddProductFlow = () => {
    setCurrentStage("A");
    setSelectedProduct(null);
    setFormData(null);
    setVerificationResult(null);
    setExistingStockPrice({ stock: "", price: "" });
    setExistingErrors({});
  };

  const handleCustomSelected = () => {
    setCurrentStage("B");
  };

  const handleProductSelected = (product) => {
    setSelectedProduct(product);
    if (!product) {
      setExistingStockPrice({ stock: "", price: "" });
      setExistingErrors({});
        return;
      }
      // If the seller already stocks this GlobalProduct, prefill the
      // form with the current stock & price so the submit call updates
      // the existing row (PATCH) rather than re-creating one.
      if (product.existing) {
        setExistingStockPrice({
          stock: String(product.existing.stock),
          price: String(product.existing.price),
        });
      } else {
        setExistingStockPrice({ stock: "", price: "" });
      }
      setExistingErrors({});
    };

    const submitProductData = async (data) => {
      setCurrentStage("C"); // Submitting state
      try {
        // If the product is already in the seller's inventory, route
        // straight to PATCH /api/seller/inventory/[id] and skip the
        // POST (which would 409). This makes the UX feel like a single
        // "save" regardless of whether it's a create or an update.
        if (selectedProduct?.existing) {
          const updateRes = await fetch(
            `/api/seller/inventory/${selectedProduct.existing.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                stock: Number(data.stock),
                price: Number(data.price),
              }),
            },
          );
          const updateData = await updateRes.json();
          if (!updateRes.ok) {
            throw new Error(updateData.error || "Failed to update product");
          }
          // Show a success state and then bounce the user to the
          // inventory table so they can see the updated row.
          setVerificationResult({
            productCode: updateData.product?.productCode || "",
            qrCode: updateData.product?.qrCode || "",
            sellerCode:
              updateData.product?.qrCode?.split?.("_")?.[0] || "",
            price: updateData.product?.price ?? Number(data.price),
            productName:
              updateData.product?.customName ||
              updateData.product?.globalProduct?.name ||
              selectedProduct.name ||
              "Product",
            updated: true,
          });
          setCurrentStage("D");
          return;
        }

        const res = await fetch("/api/seller/product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const resData = await res.json();

        // Race-safe: if the server detected a duplicate (e.g. another
        // browser tab added the same product between search and submit),
        // switch to the PATCH path automatically.
        if (
          res.status === 409 &&
          resData.code === "DUPLICATE_SELLER_PRODUCT" &&
          resData.existing?.id
        ) {
          const existingId = resData.existing.id;
          const updateRes = await fetch(
            `/api/seller/inventory/${existingId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                stock: Number(data.stock),
                price: Number(data.price),
              }),
            },
          );
          const updateData = await updateRes.json();
          if (!updateRes.ok) {
            throw new Error(
              updateData.error || "Failed to update existing product",
            );
          }
          setVerificationResult({
            productCode: updateData.product?.productCode || "",
            qrCode: updateData.product?.qrCode || "",
            sellerCode:
              updateData.product?.qrCode?.split?.("_")?.[0] || "",
            price: updateData.product?.price ?? Number(data.price),
            productName:
              updateData.product?.customName ||
              updateData.product?.globalProduct?.name ||
              selectedProduct?.name ||
              "Product",
            updated: true,
          });
          setCurrentStage("D");
          return;
        }

        if (!res.ok) throw new Error(resData.error || "Failed to submit");

      setVerificationResult({
        productCode: resData.product?.productCode || "",
        qrCode: resData.product?.qrCode || "",
        sellerCode: resData.product?.qrCode?.split?.("_")?.[0] || "",
        price: resData.product?.price ?? Number(data.price),
        productName:
          resData.product?.customName ||
          resData.product?.globalProduct?.name ||
          selectedProduct?.name ||
          "Product",
        updated: false,
      });
      setCurrentStage("D");
    } catch (err) {
      alert("Error: " + err.message);
      setCurrentStage("A");
    }
  };

  const handleExistingSubmit = () => {
    const errors: any = {};
    if (!existingStockPrice.stock || Number(existingStockPrice.stock) < 1) {
      errors.stock = "Valid stock is required.";
    }
    if (!existingStockPrice.price || Number(existingStockPrice.price) < 1) {
      errors.price = "Valid price is required.";
    }
    
    if (Object.keys(errors).length > 0) {
      setExistingErrors(errors);
      return;
    }
    
    submitProductData({
      globalProductId: selectedProduct.id,
      stock: existingStockPrice.stock,
      price: existingStockPrice.price,
    });
  };

  const handleCustomFormSubmit = (data) => {
    submitProductData(data);
  };

  const renderAddProductFlow = () => {
    if (currentStage === "A") {
      return (
        <div className="space-y-6">
          <ProductSearch 
            onProductSelected={handleProductSelected}
            onCustomSelected={handleCustomSelected}
          />
          
          {selectedProduct && (
            <div className="max-w-2xl mx-auto bg-white p-6 border border-gray-200 rounded-md shadow-sm mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Set Price & Stock</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity*</label>
                  <input
                    type="number"
                    min="1"
                    value={existingStockPrice.stock}
                    onChange={(e) => {
                      setExistingStockPrice(prev => ({ ...prev, stock: e.target.value }));
                      setExistingErrors(prev => ({ ...prev, stock: null }));
                    }}
                    className={`w-full border rounded-md px-3 py-2 focus:ring-orange-500 focus:border-orange-500 ${existingErrors.stock ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {existingErrors.stock && <p className="text-xs text-red-500 mt-1">{existingErrors.stock}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (BDT)*</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 font-medium">৳</span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={existingStockPrice.price}
                      onChange={(e) => {
                        setExistingStockPrice(prev => ({ ...prev, price: e.target.value }));
                        setExistingErrors(prev => ({ ...prev, price: null }));
                      }}
                      className={`w-full border rounded-md pl-8 pr-3 py-2 focus:ring-orange-500 focus:border-orange-500 ${existingErrors.price ? 'border-red-500' : 'border-gray-300'}`}
                    />
                  </div>
                  {existingErrors.price && <p className="text-xs text-red-500 mt-1">{existingErrors.price}</p>}
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleExistingSubmit}
                  className="bg-orange-500 text-white px-6 py-2 rounded-md font-semibold hover:bg-orange-600 transition"
                >
                  Submit Product →
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    if (currentStage === "B") {
      return (
        <CustomProductForm 
          initialData={formData}
          onBack={() => setCurrentStage("A")}
          onSubmit={handleCustomFormSubmit}
        />
      );
    }

    if (currentStage === "C") {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 font-medium">Adding product to your inventory...</p>
        </div>
      );
    }

    if (currentStage === "D") {
        return (
          <QRResult
            qrCode={verificationResult.qrCode}
            productName={verificationResult.productName}
            updated={verificationResult.updated}
            onAddAnother={resetAddProductFlow}
            onGoToInventory={() => {
              resetAddProductFlow();
              setActiveTab("inventory");
            }}
          />
        );
      }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar (Desktop) / Bottom Tab Bar (Mobile) */}
      <nav className="w-full md:w-64 bg-white border-r border-gray-200 shadow-sm flex-shrink-0 flex flex-col fixed md:sticky top-0 bottom-0 z-10">
        <div className="p-6 hidden md:block border-b border-gray-100">
          <Link href="/" className="text-2xl font-bold text-orange-500 mb-6 block">
            NodeCommerce
          </Link>
          <div className="flex items-center gap-3">
            {sellerProfile?.avatarUrl ? (
              <img src={sellerProfile.avatarUrl} alt="Store" className="w-10 h-10 rounded-full object-cover border" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                {sellerProfile?.storeName?.[0] || "S"}
              </div>
            )}
            <div className="overflow-hidden">
              <p className="font-semibold text-gray-900 truncate">{sellerProfile?.storeName || "My Store"}</p>
              <p className="text-xs text-gray-500 truncate">Seller ID: {sellerProfile?.sellerCode || "---"}</p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-row md:flex-col justify-around md:justify-start flex-1 p-2 md:p-4 gap-1 overflow-y-auto">
          <button
            onClick={() => setActiveTab("inventory")}
            className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 px-2 md:px-4 py-3 md:py-3 rounded-md transition-colors ${
              activeTab === "inventory" ? "bg-orange-50 text-orange-600 font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            <span className="text-xs md:text-sm">Inventory</span>
          </button>
          
          <button
            onClick={() => setActiveTab("add-product")}
            className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 px-2 md:px-4 py-3 md:py-3 rounded-md transition-colors ${
              activeTab === "add-product" ? "bg-orange-50 text-orange-600 font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            <span className="text-xs md:text-sm">Add Product</span>
          </button>
          
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 px-2 md:px-4 py-3 md:py-3 rounded-md transition-colors ${
              activeTab === "profile" ? "bg-orange-50 text-orange-600 font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <span className="text-xs md:text-sm">Profile</span>
          </button>
          
          <button
            onClick={() => setActiveTab("orders")}
            className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 px-2 md:px-4 py-3 md:py-3 rounded-md transition-colors ${
              activeTab === "orders" ? "bg-orange-50 text-orange-600 font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            <span className="text-xs md:text-sm">B2C Orders</span>
          </button>

          <button
            onClick={() => setActiveTab("stock-orders")}
            className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 px-2 md:px-4 py-3 md:py-3 rounded-md transition-colors ${
              activeTab === "stock-orders" ? "bg-orange-50 text-orange-600 font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            <span className="text-xs md:text-sm">Stock Orders</span>
          </button>

          <button
            onClick={() => setActiveTab("aco-shipments")}
            className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 px-2 md:px-4 py-3 md:py-3 rounded-md transition-colors ${
              activeTab === "aco-shipments" ? "bg-purple-50 text-purple-600 font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <span className="text-xl leading-none">🐜</span>
            <span className="text-xs md:text-sm">ACO Pipeline</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 mb-16 md:mb-0">
        <header className="mb-8 hidden md:flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {activeTab === "inventory" && "Inventory Management"}
              {activeTab === "profile" && "Store Settings"}
              {activeTab === "add-product" && "Add New Product"}
              {activeTab === "orders" && "Order Management"}
              {activeTab === "stock-orders" && "Upazilla Stock Orders"}
              {activeTab === "aco-shipments" && "ACO Pipeline"}
            </h1>
            <p className="text-gray-600 mt-1">
              {activeTab === "inventory" && "View and manage your store's products."}
              {activeTab === "profile" && "Update your store's public profile."}
              {activeTab === "add-product" && "Search existing catalog or list a new item."}
              {activeTab === "orders" && "View and fulfill customer orders."}
              {activeTab === "stock-orders" && "Manage wholesale stock requests from Upazilla Resellers."}
              {activeTab === "aco-shipments" && "View Phase 1 Automated Routing Shipments."}
            </p>
          </div>
          <Link href="/" className="text-sm text-orange-600 hover:underline font-medium">
            ← View Storefront
          </Link>
        </header>

        <div className="w-full max-w-6xl mx-auto space-y-6">
          {/* Stats Cards — visible in inventory and orders tabs */}
          {(activeTab === "inventory" || activeTab === "orders") && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                labelBn="মোট আয়"
                labelEn="Total Revenue"
                value={`৳${(stats?.totalRevenue ?? 0).toLocaleString("en-BD")}`}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 6v1m0 3v1M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                  </svg>
                }
                accentColor="var(--nc-success)"
              />
              <MetricCard
                labelBn="মোট অর্ডার"
                labelEn="Total Orders"
                value={stats?.totalOrders ?? 0}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                }
                accentColor="var(--nc-primary)"
              />
              <MetricCard
                labelBn="পেন্ডিং অর্ডার"
                labelEn="Pending Orders"
                value={stats?.pendingCount ?? 0}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                accentColor="var(--nc-warning)"
              />
              <MetricCard
                labelBn="পণ্য তালিকাভুক্ত"
                labelEn="Products Listed"
                value={stats?.inventory ?? 0}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                }
                accentColor="var(--nc-info)"
              />
            </div>
          )}

          {activeTab === "inventory" && <InventoryTable />}
          {activeTab === "profile" && <ProfileSection />}
          {activeTab === "add-product" && renderAddProductFlow()}
          {activeTab === "orders" && <OrdersTab />}
          {activeTab === "stock-orders" && <StockOrdersPanel />}
          {activeTab === "aco-shipments" && <AcoShipmentsPanel />}
        </div>
      </main>
    </div>
  );
}
