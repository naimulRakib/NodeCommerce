import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import HomeShell from "@/components/home-shell";
import TopAuthBar from "@/components/top-auth-bar";

export default async function ProductPage({ params }) {
  const { productCode } = await params;

  const product = await prisma.sellerProduct.findUnique({
    where: { productCode },
    include: {
      globalProduct: true,
      seller: true,
    },
  });

  if (!product) {
    return notFound();
  }

  const name = product.customName || product.globalProduct?.name || "Unknown Product";
  const desc = product.globalProduct?.description || "No detailed description provided.";
  const imageUrl = product.globalProduct?.imageUrl;
  const brand = product.globalProduct?.brand;
  const category = product.globalProduct?.category;

  return (
    <HomeShell>
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="w-full bg-gray-100 flex justify-center py-1 text-xs">
          <TopAuthBar />
        </div>

        <header className="w-full border-b pb-4 pt-4 bg-white">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-8">
            <Link href="/" className="text-3xl font-bold text-orange-500">
              NodeCommerce
            </Link>
            <div className="flex-1 flex max-w-3xl">
              <input 
                type="text" 
                placeholder="Search in NodeCommerce" 
                className="w-full border rounded-l-md px-4 py-2 focus:outline-none focus:border-orange-500 bg-gray-50"
              />
              <button className="bg-orange-500 text-white px-8 rounded-r-md hover:bg-orange-600 transition">
                Search
              </button>
            </div>
            <div className="flex items-center">
              <Link href="/cart" className="flex items-center gap-2 border p-2 rounded-md hover:bg-gray-50 transition">
                <span className="text-xl">🛒</span>
                <span className="font-semibold">Cart</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 w-full flex-1 py-8">
          {/* Breadcrumb */}
          <div className="text-sm text-gray-500 mb-6 flex gap-2">
            <Link href="/" className="hover:text-orange-500 hover:underline">Home</Link>
            <span>&gt;</span>
            {category && (
              <>
                <Link href="#" className="hover:text-orange-500 hover:underline">{category}</Link>
                <span>&gt;</span>
              </>
            )}
            <span className="text-gray-900 truncate">{name}</span>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 md:p-10">
              
              {/* Product Image */}
              <div className="flex items-center justify-center bg-gray-50 rounded-lg p-4 h-[400px] border border-gray-100">
                {imageUrl ? (
                  <img 
                    src={imageUrl} 
                    alt={name} 
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span>No Product Image</span>
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="flex flex-col">
                <h1 className="text-2xl font-semibold text-gray-900 mb-2">{name}</h1>
                
                {/* Brand & Ratings */}
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4 pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-1 text-yellow-500">
                    <span>★★★★☆</span>
                    <span className="text-gray-500 ml-1">(0 Ratings)</span>
                  </div>
                  {brand && (
                    <div className="flex items-center gap-1">
                      <span>Brand:</span>
                      <Link href="#" className="text-blue-600 hover:underline">{brand}</Link>
                    </div>
                  )}
                </div>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl font-bold text-orange-500">
                    ৳ {Number(product.price).toLocaleString("en-BD")}
                  </span>
                </div>

                {/* Seller Info */}
                <div className="mb-8 p-4 bg-gray-50 rounded-md border border-gray-100">
                  <p className="text-sm text-gray-500 mb-1">Sold by</p>
                  <p className="font-semibold text-gray-900">{product.seller?.storeName || "Unknown Seller"}</p>
                  <p className="text-xs text-gray-500">Stock Available: {product.stock}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-4 mt-auto">
                  <button className="flex-1 bg-orange-500 text-white font-semibold py-3 rounded-md hover:bg-orange-600 transition shadow-sm">
                    Buy Now
                  </button>
                  <button className="flex-1 bg-orange-100 text-orange-600 font-semibold py-3 rounded-md hover:bg-orange-200 transition">
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
            
            {/* Description Section */}
            <div className="border-t border-gray-200">
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <h2 className="font-semibold text-gray-800">Product Description</h2>
              </div>
              <div className="p-6 md:p-10">
                <div className="prose prose-sm md:prose-base max-w-none text-gray-700 whitespace-pre-line">
                  {desc}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </HomeShell>
  );
}
