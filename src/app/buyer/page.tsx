import { prisma } from "@/lib/prisma";
import ProductCard from "@/components/buyer/ProductCard";
import RecentProductsGrid from "@/components/buyer/RecentProductsGrid";
import Link from "next/link";
import { CATEGORIES } from "@/data/categories";

export default async function BuyerHomePage() {
  // Fetch recently listed approved products
  const recentProducts = await prisma.sellerProduct.findMany({
    where: { status: "approved", stock: { gt: 0 } },
    include: {
      globalProduct: true,
      seller: { select: { storeName: true, city: true, upazilla: true, sellerCode: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 8
  });

  const formattedRecent = recentProducts.map((sp: any) => ({
    id: sp.id,
    name: sp.customName || sp.globalProduct?.name || "Unknown",
    brand: sp.globalProduct?.brand || "",
    category: sp.globalProduct?.category || "",
    imageUrl: sp.globalProduct?.imageUrl || "",
    price: sp.price,
    stock: sp.stock,
    seller: sp.seller
  }));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hero */}
      <div className="bg-orange-600 text-white py-16 sm:py-24 px-4 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl mb-6">
          Find Everything You Need
        </h1>
        <p className="max-w-2xl mx-auto text-xl text-orange-100 mb-10">
          Shop from thousands of local sellers across Bangladesh. Fast, reliable, and authentic.
        </p>
        <Link 
          href="/buyer/search" 
          className="inline-block bg-white text-orange-600 px-8 py-3 rounded-full font-bold text-lg hover:bg-orange-50 transition shadow-md"
        >
          Start Browsing
        </Link>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 w-full">
        {/* Categories */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Categories</h2>
            <Link href="/buyer/search" className="text-orange-600 font-medium hover:underline">View All →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {CATEGORIES.slice(0, 12).map((cat) => (
              <Link 
                key={cat} 
                href={`/buyer/search?category=${encodeURIComponent(cat)}`}
                className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center hover:shadow-md hover:border-orange-200 transition group"
              >
                <div className="w-12 h-12 mx-auto bg-orange-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-orange-100 transition">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-orange-600 transition line-clamp-1">{cat}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Recently Listed */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recently Listed</h2>
            <Link href="/buyer/search" className="text-orange-600 font-medium hover:underline">View More →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            <RecentProductsGrid products={formattedRecent} />
          </div>
        </section>
      </main>
    </div>
  );
}
