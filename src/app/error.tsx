"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route Error Caught:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-neutral-950 text-white p-6 rounded-2xl border border-neutral-800/50 m-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white mb-2">Component Crashed</h2>
          <p className="text-neutral-400 text-sm">
            We encountered a problem rendering this specific section. The rest of the dashboard is still operational.
          </p>
        </div>
        <div className="bg-neutral-900 p-4 rounded-lg text-left overflow-x-auto border border-neutral-800">
          <code className="text-xs text-amber-400 font-mono">
            {error.message || "Render Exception"}
          </code>
        </div>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white transition-colors rounded-lg font-medium text-sm border border-neutral-700"
          >
            Try Again
          </button>
          <Link href="/">
            <button className="px-6 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 transition-colors rounded-lg font-medium text-sm border border-amber-500/20">
              Return Home
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
