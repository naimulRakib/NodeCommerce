"use client";

import LoginForm from "@/components/login-form";
import { SELLER_DASHBOARD_PATH } from "@/components/seller-auth-provider";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  redirectTo?: string;
}

export default function LoginModal({
  open,
  onClose,
  redirectTo = SELLER_DASHBOARD_PATH,
}: LoginModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close login dialog"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2
            id="login-modal-title"
            className="text-xl font-semibold text-gray-900"
          >
            Seller Login
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <LoginForm onSuccess={onClose} redirectTo={redirectTo} />
      </div>
    </div>
  );
}
