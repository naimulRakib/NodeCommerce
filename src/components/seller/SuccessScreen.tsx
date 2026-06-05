'use client';

import Link from "next/link";

interface SuccessScreenProps {
  email: string;
}


export default function SuccessScreen({ email }: SuccessScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12 px-4 text-center">
      {/* Email Icon */}
      <div className="text-6xl">✉️</div>

      <h2 className="text-3xl font-bold text-gray-800">Account Created!</h2>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md">
        <p className="text-gray-700 mb-2">
          We&apos;ve sent a verification email to:
        </p>

        <p className="font-semibold text-gray-900 break-all">{email}</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 max-w-md space-y-2">
        <p className="font-semibold text-gray-800">What&apos;s next?</p>
        <ol className="text-left text-sm text-gray-600 space-y-2">
          <li>1️⃣ Check your email inbox (or spam folder)</li>
          <li>2️⃣ Click the verification link</li>
          <li>3️⃣ Return to login and access your seller dashboard</li>
        </ol>
      </div>


      <p className="text-sm text-gray-500 mt-6 max-w-md">
        Didn&apos;t receive the email?{' '}
        <button className="text-orange-500 hover:text-orange-600 font-medium">
          Resend email
        </button>
      </p>


      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <Link
          href="/login"
          className="px-8 py-3 bg-orange-500 text-white rounded-md hover:bg-orange-600 font-medium transition text-center"
        >
          Sign in
        </Link>
        <Link
          href="/"
          className="px-8 py-3 border border-orange-500 text-orange-500 rounded-md hover:bg-orange-50 font-medium transition text-center"
        >
          ← Back to Home
        </Link>
      </div>
    </div>

  );
}

