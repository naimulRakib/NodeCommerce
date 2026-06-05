"use client";

export default function ProductCard({ product, onAddToCart, onViewDetail }: any) {
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;

  return (
    <div
      onClick={() => onViewDetail(product)}
      className="group relative flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full"
    >
      <div className="aspect-w-1 aspect-h-1 bg-gray-200 w-full overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-center object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
            No Image
          </div>
        )}
      </div>
      
      <div className="flex-1 p-4 flex flex-col">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug h-10 mb-1">
          {product.name}
        </h3>
        
        <p className="text-xs text-gray-500 mb-2 truncate">
          {product.brand ? `${product.brand} • ` : ""}{product.category}
        </p>
        
        <div className="mt-auto">
          <p className="text-lg font-bold text-gray-900 mb-1">
            ৳{Number(product.price).toLocaleString("en-BD")}
          </p>
          
          <div className="flex items-center text-xs text-gray-500 mb-3">
            <svg className="w-3.5 h-3.5 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">{product.seller.storeName}, {product.seller.upazilla}</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              {isOutOfStock ? (
                <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">Out of Stock</span>
              ) : isLowStock ? (
                <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded">Only {product.stock} left!</span>
              ) : null}
            </div>

            <button
              disabled={isOutOfStock}
              onClick={(e) => {
                e.stopPropagation();
                if (!isOutOfStock) {
                  fetch("/api/buyer/behaviour", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: "add_to_cart", payload: { productId: product.id } })
                  }).catch(() => {});
                  onAddToCart(product);
                }
              }}
              className="ml-auto flex items-center justify-center p-2 rounded-full bg-orange-100 text-orange-600 hover:bg-orange-600 hover:text-white transition-colors disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400"
              title="Add to Cart"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
