export default function OrderStatusBadge({ status }: { status: string }) {
  const styles: any = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed: "bg-blue-100 text-blue-800 border-blue-200",
    processing: "bg-purple-100 text-purple-800 border-purple-200",
    shipped: "bg-indigo-100 text-indigo-800 border-indigo-200",
    delivered: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-red-100 text-red-800 border-red-200"
  };

  const labels: any = {
    pending: "⏳ Pending",
    confirmed: "✓ Confirmed",
    processing: "📦 Processing",
    shipped: "🚚 Shipped",
    delivered: "✅ Delivered",
    cancelled: "✗ Cancelled"
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] || "bg-gray-100 text-gray-800 border-gray-200"}`}>
      {labels[status] || status}
    </span>
  );
}
