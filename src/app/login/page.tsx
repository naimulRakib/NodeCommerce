import Link from "next/link";
import LoginForm from "@/components/login-form";

export const metadata = {
  title: "Seller Login | NodeCommerce",
  description: "Sign in to your NodeCommerce seller account",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-orange-500">
            NodeCommerce
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900 mt-4">
            Seller Login
          </h1>
          <p className="text-gray-600 text-sm mt-2">
            Sign in to open your seller dashboard.
          </p>
        </div>

        <LoginForm redirectTo="/seller/dashboard" />

        <p className="text-center text-sm text-gray-600 mt-6">
          New seller?{" "}
          <Link href="/seller" className="text-orange-500 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
