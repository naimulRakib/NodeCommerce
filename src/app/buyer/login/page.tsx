import Link from "next/link";
import BuyerLoginForm from "@/components/buyer-login-form";

export const metadata = {
  title: "Buyer Login | NodeCommerce",
  description: "Sign in to your NodeCommerce buyer account",
};

export default function BuyerLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-orange-500">
            NodeCommerce
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900 mt-4">
            Buyer Login
          </h1>
          <p className="text-gray-600 text-sm mt-2">
            Sign in to access your buyer dashboard and orders.
          </p>
        </div>

        <BuyerLoginForm redirectTo="/buyer/dashboard" />
      </div>
    </div>
  );
}
