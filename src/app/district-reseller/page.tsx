import Link from "next/link";

export default function DistrictResellerLandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center bg-white py-10 px-8 shadow sm:rounded-lg">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
          District Reseller Portal
        </h1>
        <p className="mt-2 text-md text-gray-600">
          Manage stock supply across all upazillas in your district.
        </p>
        <div className="mt-6">
          <Link
            href="/district-reseller/login"
            className="w-full inline-flex justify-center py-3 px-6 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none transition-colors"
          >
            Login →
          </Link>
        </div>
      </div>
    </div>
  );
}
