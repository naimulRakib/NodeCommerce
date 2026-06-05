import Link from "next/link";

export default function UpazillaResellerLandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
          📦
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
          Upazilla Reseller Portal
        </h1>
        <p className="text-lg text-gray-600 mb-8 max-w-sm mx-auto">
          Monitor local resellers, manage stock, and fulfill supply demands in your upazilla.
        </p>
        <Link
          href="/upazilla-reseller/login"
          className="inline-flex items-center justify-center w-full px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 md:w-auto shadow-sm transition"
        >
          Login →
        </Link>
      </div>
    </div>
  );
}
