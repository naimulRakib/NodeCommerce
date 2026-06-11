import ResellerOrdersPanel from '@/components/delivery/ResellerOrdersPanel';

export const metadata = {
  title: 'Delivery Management | NodeCommerce',
};

export default function ResellerDeliveryPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Delivery Management</h1>
          <p className="text-gray-500 mt-2">Manage local orders, route deliveries, and track drop-offs.</p>
        </header>

        <ResellerOrdersPanel />
      </div>
    </div>
  );
}
