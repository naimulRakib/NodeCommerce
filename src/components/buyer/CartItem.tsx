"use client";

export default function CartItem({ item, onQuantityChange, onRemove }: any) {
  const p = item.sellerProduct;
  const price = p.price;
  const name = p.customName || p.globalProduct?.name || "Unknown Product";
  const store = p.seller?.storeName || "Unknown Seller";
  const image = p.globalProduct?.imageUrl;
  const stock = p.stock;
  
  const lineTotal = price * item.quantity;
  const isLowStock = stock > 0 && stock <= 5;
  const isOutOfStock = stock === 0;

  return (
    <div className="flex gap-4 py-4 border-b border-gray-100 relative">
      {/* Thumbnail */}
      <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden border border-gray-200">
        {image ? (
          <img src={image} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No img</div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 flex flex-col justify-between">
        <div className="pr-8">
          <h4 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">{name}</h4>
          <p className="text-xs text-gray-500 mt-1">Sold by {store}</p>
          <div className="text-sm font-bold text-gray-900 mt-1">৳{price.toLocaleString("en-BD")}</div>
        </div>

        {/* Quantity Controls & Warning */}
        <div className="flex items-end justify-between mt-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-gray-300 rounded-md bg-white">
              <button
                onClick={() => onQuantityChange(item.id, item.quantity - 1)}
                className="px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                {item.quantity === 1 ? (
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                ) : "-"}
              </button>
              <span className="px-3 text-sm font-medium border-x border-gray-200 w-10 text-center">
                {item.quantity}
              </span>
              <button
                onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                disabled={item.quantity >= stock}
                className="px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm font-bold text-gray-900">৳{lineTotal.toLocaleString("en-BD")}</div>
          </div>
        </div>
        
        {(isLowStock || isOutOfStock) && (
          <div className="mt-1">
            {isOutOfStock ? (
              <span className="text-xs text-red-600 font-medium">Out of stock (Please remove)</span>
            ) : (
              <span className="text-xs text-orange-600 font-medium">Only {stock} left!</span>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => onRemove(item.id)}
        className="absolute top-4 right-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
        title="Remove"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}
