import Link from "next/link";
import HomeShell from "@/components/home-shell";
import TopAuthBar from "@/components/top-auth-bar";
import { prisma } from "@/lib/prisma";

// Category icons — inline SVGs mapped to category names
const CATEGORY_ICONS: Record<string, string> = {
  "Electronics":    "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  "Fashion":        "M3 7h18M3 12h18M3 17h18",
  "Home & Garden":  "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  "Sports":         "M13 10V3L4 14h7v7l9-11h-7z",
  "Books":          "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  "Health":         "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  "Toys":           "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  "Food":           "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
  "Automotive":     "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  "Beauty":         "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  "Jewelry":        "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
};

export default async function Home() {
  const [products, sellers] = await Promise.all([
    prisma.sellerProduct.findMany({
      where: { status: "approved", stock: { gt: 0 } },
      include: {
        globalProduct: true,
        seller: { select: { storeName: true, city: true, sellerCode: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    // Fix Q6: count only seller profiles, not all profiles
    prisma.profile.count({ where: { role: "seller" } }),
  ]);

  const categories = Object.keys(CATEGORY_ICONS);

  const formattedProducts = products.map((sp: any) => ({
    id: sp.id,
    name: sp.customName || sp.globalProduct?.name || "Product",
    brand: sp.globalProduct?.brand || "",
    category: sp.globalProduct?.category || "",
    imageUrl: sp.globalProduct?.imageUrl || "",
    price: sp.price,
    stock: sp.stock,
    seller: sp.seller,
  }));

  return (
    <HomeShell>
      <div className="flex flex-col min-h-screen bg-gray-50">

        {/* ── Top Bar ───────────────────────────────────── */}
        <div className="w-full bg-gray-900 text-gray-300 text-xs py-1.5 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span>🛡️ Secure & trusted marketplace • Fast delivery across Bangladesh</span>
            <TopAuthBar />
          </div>
        </div>

        {/* ── Header ────────────────────────────────────── */}
        <header className="w-full bg-gradient-to-r from-orange-600 to-orange-500 shadow-md sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-6 h-16">
            <Link href="/" className="text-white font-extrabold text-2xl tracking-tight flex-shrink-0">
              Node<span className="text-orange-200">Commerce</span>
            </Link>

            {/* Search */}
            <form action="/buyer/search" method="get" className="flex-1 flex max-w-2xl">
              <input
                name="q"
                type="text"
                placeholder="Search products, brands, categories…"
                className="w-full rounded-l-lg px-4 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-gray-400"
              />
              <button
                type="submit"
                className="bg-orange-800 hover:bg-orange-900 text-white px-5 rounded-r-lg flex items-center gap-2 text-sm font-semibold transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1116.65 2a7.5 7.5 0 010 14.65z" />
                </svg>
                Search
              </button>
            </form>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-3 flex-shrink-0">
              <Link href="/buyer/login" className="text-white/90 hover:text-white text-sm font-medium transition">Sign In</Link>
              <Link href="/buyer/register" className="bg-white text-orange-600 text-sm font-bold px-4 py-1.5 rounded-full hover:bg-orange-50 transition">
                Register
              </Link>
              
              <div className="w-px h-5 bg-white/30 mx-1"></div>

              <div className="flex gap-2">
                <Link href="/seller" className="text-white/90 hover:text-white text-xs font-medium transition border border-white/40 px-3 py-1 rounded-full hover:bg-white/10">
                  Seller Portal
                </Link>
                <Link href="/local-reseller/login" className="text-white/90 hover:text-white text-xs font-medium transition border border-white/40 px-3 py-1 rounded-full hover:bg-white/10">
                  Local Reseller
                </Link>
                <Link href="/upazilla-reseller/login" className="text-white/90 hover:text-white text-xs font-medium transition border border-white/40 px-3 py-1 rounded-full hover:bg-white/10">
                  Upazilla Reseller
                </Link>
              </div>
            </nav>
          </div>
        </header>

        {/* ── Hero Section ──────────────────────────────── */}
        <section className="bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white py-20 px-4 relative overflow-hidden">
          {/* decorative blobs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-orange-800/20 rounded-full blur-2xl" />
          </div>

          <div className="relative max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-white/30">
              🇧🇩 বাংলাদেশের স্থানীয় মার্কেটপ্লেস · Bangladesh&apos;s Local Marketplace
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
              Shop Local.<br />
              <span className="text-orange-200">Delivered Fast.</span>
            </h1>
            <p className="text-lg sm:text-xl text-orange-100 mb-10 max-w-2xl mx-auto leading-relaxed">
              Discover thousands of products from verified sellers across Bangladesh.
              Best prices, secure checkout, and delivery to your door.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/buyer/search"
                className="inline-flex items-center gap-2 bg-white text-orange-600 font-bold px-8 py-4 rounded-full text-lg hover:bg-orange-50 transition shadow-lg shadow-orange-900/20 hover:shadow-xl hover:-translate-y-0.5 transform"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1116.65 2a7.5 7.5 0 010 14.65z" />
                </svg>
                Browse All Products
              </Link>
              <Link
                href="/seller"
                className="inline-flex items-center gap-2 border-2 border-white/50 text-white font-bold px-8 py-4 rounded-full text-lg hover:bg-white/10 transition"
              >
                Start Selling →
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-14 grid grid-cols-3 gap-6 max-w-lg mx-auto">
              {[
                { label: "Active Sellers", value: `${sellers}+` },
                { label: "Products Listed", value: `${products.length}+` },
                { label: "Secure Payments", value: "100%" },
              ].map(stat => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-extrabold text-white">{stat.value}</div>
                  <div className="text-xs text-orange-200 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-12 space-y-16">

          {/* ── Categories ─────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Shop by Category</h2>
                <p className="text-sm text-gray-500 mt-0.5">Find exactly what you&apos;re looking for</p>
              </div>
              <Link href="/buyer/search" className="text-orange-600 font-semibold text-sm hover:underline flex items-center gap-1">
                All Categories →
              </Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-3">
              {categories.map(cat => (
                <Link
                  key={cat}
                  href={`/buyer/search?category=${encodeURIComponent(cat)}`}
                  className="group flex flex-col items-center gap-2 p-3 bg-white rounded-xl border border-gray-100 hover:border-orange-200 hover:shadow-md hover:-translate-y-1 transition-all duration-200 text-center"
                >
                  <div className="w-11 h-11 rounded-full bg-orange-50 group-hover:bg-orange-100 flex items-center justify-center transition">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={CATEGORY_ICONS[cat]} />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-gray-700 group-hover:text-orange-600 transition line-clamp-1">{cat}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* ── New Arrivals ────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">New Arrivals</h2>
                <p className="text-sm text-gray-500 mt-0.5">Fresh products just listed by sellers near you</p>
              </div>
              <Link href="/buyer/search" className="text-orange-600 font-semibold text-sm hover:underline">
                See All →
              </Link>
            </div>

            {formattedProducts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                <p className="text-gray-400 text-lg">No products yet — be the first to list!</p>
                <Link href="/seller" className="mt-4 inline-block text-orange-600 font-semibold hover:underline">
                  Start Selling
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {formattedProducts.map(product => (
                  <Link
                    key={product.id}
                    href={`/buyer/product/${product.id}`}
                    className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                  >
                    <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">In Stock</span>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-gray-400 mb-0.5">{product.brand || product.category}</p>
                      <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">{product.name}</p>
                      <p className="text-orange-600 font-bold text-base mt-1.5">৳{product.price.toLocaleString("en-BD")}</p>
                      <p className="text-xs text-gray-400 mt-1 truncate">{product.seller?.storeName}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* ── Trust Badges ────────────────────────────── */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "Buyer Protection", desc: "100% secure shopping" },
              { icon: "M13 10V3L4 14h7v7l9-11h-7z", label: "Fast Delivery", desc: "Delivered to your door" },
              { icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", label: "Easy Returns", desc: "7-day return policy" },
              { icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z", label: "Local Sellers", desc: "Verified seller network" },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-5 flex items-start gap-3 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </section>

          {/* ── Seller CTA ──────────────────────────────── */}
          <section className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 sm:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/20 rounded-full blur-3xl" />
            </div>
            <div className="relative">
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">Ready to start selling?</h2>
              <p className="text-gray-400 text-sm max-w-md">Join thousands of local sellers already earning on NodeCommerce. Set up your store in minutes — no monthly fees.</p>
            </div>
            <div className="relative flex-shrink-0">
              <Link
                href="/seller"
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-4 rounded-full transition hover:shadow-lg hover:shadow-orange-500/25 transform hover:-translate-y-0.5"
              >
                Open Your Store
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </section>
        </main>

        {/* ── Footer ──────────────────────────────────── */}
        <footer className="bg-gray-900 text-gray-400 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
              <div>
                <h3 className="text-white font-extrabold text-xl mb-4">Node<span className="text-orange-400">Commerce</span></h3>
                <p className="text-sm leading-relaxed">Bangladesh&apos;s fastest-growing local marketplace. Connecting buyers and sellers since 2025.</p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Buyers</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/buyer/search" className="hover:text-white transition">Browse Products</Link></li>
                  <li><Link href="/buyer/login" className="hover:text-white transition">Sign In</Link></li>
                  <li><Link href="/buyer/register" className="hover:text-white transition">Create Account</Link></li>
                  <li><Link href="/buyer/dashboard?tab=orders" className="hover:text-white transition">My Orders</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Sellers</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/seller" className="hover:text-white transition">Start Selling</Link></li>
                  <li><Link href="/seller/dashboard" className="hover:text-white transition">Seller Dashboard</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Company</h4>
                <ul className="space-y-2 text-sm">
                  <li><span className="cursor-default">About Us</span></li>
                  <li><span className="cursor-default">Privacy Policy</span></li>
                  <li><span className="cursor-default">Terms of Service</span></li>
                  <li><span className="cursor-default">Contact Support</span></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              <p>© 2026 NodeCommerce Bangladesh. All rights reserved.</p>
              <p>Made with ❤️ in Bangladesh</p>
            </div>
          </div>
        </footer>

      </div>
    </HomeShell>
  );
}
