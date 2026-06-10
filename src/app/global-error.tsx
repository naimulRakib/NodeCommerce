"use client";

import { useEffect } from "react";
import Link from "next/frontend";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Error Caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white p-6">
          <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-xl p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Critical System Error</h2>
              <p className="text-neutral-400 text-sm">
                A fatal error occurred in the NodeCommerce logistics engine. We have logged the incident.
              </p>
            </div>
            <div className="bg-neutral-950 p-4 rounded-lg text-left overflow-x-auto border border-neutral-800">
              <code className="text-xs text-red-400 font-mono">
                {error.message || "Unknown Application Exception"}
              </code>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => reset()}
                className="flex-1 bg-white text-black hover:bg-neutral-200 transition-colors py-3 rounded-lg font-medium"
              >
                Attempt Recovery
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-neutral-800 text-white hover:bg-neutral-700 transition-colors py-3 rounded-lg font-medium"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
