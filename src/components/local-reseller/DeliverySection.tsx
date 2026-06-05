export default function DeliverySection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Delivery Management</h2>
        <p className="mt-1 text-sm text-gray-500">
          Configure your delivery zones and options
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Card 1: Delivery Zones */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-2xl mb-4">
            📍
          </div>
          <h3 className="text-lg font-medium text-gray-900">Delivery Zones</h3>
          <p className="mt-2 text-sm text-gray-500 flex-grow">
            Set the areas you deliver to within your upazilla and nearby locations.
          </p>
          <div className="mt-6 w-full relative group">
            <button
              disabled
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-400 cursor-not-allowed"
            >
              Configure Zones
            </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block px-2 py-1 bg-gray-800 text-xs text-white rounded whitespace-nowrap">
              Coming soon
            </div>
          </div>
        </div>

        {/* Card 2: Delivery Charges */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-2xl mb-4">
            💸
          </div>
          <h3 className="text-lg font-medium text-gray-900">Delivery Charges</h3>
          <p className="mt-2 text-sm text-gray-500 flex-grow">
            Define flat or distance-based delivery fees for your customers.
          </p>
          <div className="mt-6 w-full relative group">
            <button
              disabled
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-400 cursor-not-allowed"
            >
              Set Charges
            </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block px-2 py-1 bg-gray-800 text-xs text-white rounded whitespace-nowrap">
              Coming soon
            </div>
          </div>
        </div>

        {/* Card 3: Active Deliveries */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col items-center text-center md:col-span-2 lg:col-span-1">
          <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center text-2xl mb-4">
            🚚
          </div>
          <h3 className="text-lg font-medium text-gray-900">Active Deliveries</h3>
          <p className="mt-2 text-sm text-gray-500 flex-grow">
            Track and manage your ongoing deliveries in real time.
          </p>
          <div className="mt-6 w-full relative group">
            <button
              disabled
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-400 cursor-not-allowed"
            >
              View Deliveries
            </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block px-2 py-1 bg-gray-800 text-xs text-white rounded whitespace-nowrap">
              Coming soon
            </div>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-sm mt-8">
        <div className="flex items-start">
          <div className="flex-shrink-0 text-xl leading-none">
            ℹ️
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-800 font-medium">
              Delivery features are under development and will be available in a future update.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
