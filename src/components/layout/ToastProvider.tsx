"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "../ui/Toast.module.css";

/**
 * Lightweight global toast system.
 *
 * Why we built this ourselves instead of pulling react-hot-toast / sonner:
 *   1. The codebase already has 4–5 bespoke toast implementations with the
 *      same shape (message, type, auto-dismiss timer). Consolidating into
 *      one provider is a net code reduction.
 *   2. No external dep = no extra bundle weight on a Next 16 / React 19
 *      project that is already in active iteration.
 *
 * Usage:
 *   // in a client component
 *   const { showToast } = useToast();
 *   showToast("Saved!", "success");
 *   showToast("Something broke", "error");
 *
 * Mount the provider once in src/app/layout.tsx. Toasts render fixed at the
 * bottom-right of the viewport and stack with a small gap.
 */

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
  /** Override the default auto-dismiss time (ms). Set to 0 to disable. */
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind, durationMs?: number) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4000;

const KIND_STYLES: Record<ToastKind, string> = {
  success: styles.toastSuccess,
  error: styles.toastDanger,
  info: styles.toastInfo,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Use a ref so the auto-dismiss timeout ids survive re-renders without
  // causing them.
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  // Incrementing id; the ref avoids needing a state for the next id.
  const nextIdRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback<ToastContextValue["showToast"]>(
    (message, kind = "info", durationMs) => {
      const id = nextIdRef.current++;
      const toast: Toast = { id, message, kind, durationMs };
      setToasts((current) => [...current, toast]);

      const ttl = durationMs ?? DEFAULT_DURATION_MS;
      if (ttl > 0 && typeof window !== "undefined") {
        const timer = setTimeout(() => dismiss(id), ttl);
        timersRef.current.set(id, timer);
      }
    },
    [dismiss]
  );

  // Clean up any pending timers when the provider unmounts.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ showToast, dismiss }),
    [showToast, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast viewport — fixed bottom-right, stacks upward, z-index above
          modals (z-50 is the standard modal layer). */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className={styles.toastContainer}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`${styles.toast} ${KIND_STYLES[t.kind] || ""}`}
          >
            <div className={styles.toastContent}>
              <div className={styles.toastTitle}>
                {t.kind === "success" ? "সফল" : t.kind === "error" ? "ত্রুটি" : "তথ্য"}
              </div>
              <div className={styles.toastMessage}>{t.message}</div>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6 }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast() must be used within a <ToastProvider />");
  }
  return ctx;
}
