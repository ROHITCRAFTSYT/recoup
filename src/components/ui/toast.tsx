"use client";

/**
 * Toast notification system for live Lemma pod events.
 *
 * Displays non-blocking notifications when the SDK detects
 * new records, status changes, or connection events.
 */

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckIcon, AlertIcon, InfoIcon, XMarkIcon } from "@/lib/icons";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);

    const duration = toast.duration ?? 4000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: string) => void;
}) {
  if (!toasts.length) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => onRemove(toast.id)} />
      ))}
    </div>
  );
}

const ICONS: Record<ToastType, typeof CheckIcon> = {
  success: CheckIcon,
  error: AlertIcon,
  info: InfoIcon,
  warning: AlertIcon,
};

const STYLES: Record<ToastType, string> = {
  success: "border-positive/30 bg-positive-soft text-positive",
  error: "border-danger/30 bg-danger-soft text-danger",
  info: "border-accent/30 bg-accent-soft text-accent",
  warning: "border-warning/30 bg-warning-soft text-warning",
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const Icon = ICONS[toast.type];
  const style = STYLES[toast.type];

  return (
    <div
      className={`flex w-80 items-start gap-2.5 rounded-xl border p-3.5 shadow-lg animate-in slide-in-from-right duration-200 ${style}`}
      role="alert"
    >
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="flex-1">
        <div className="text-xs font-semibold">{toast.title}</div>
        {toast.message && (
          <div className="mt-0.5 text-[11px] opacity-90">{toast.message}</div>
        )}
      </div>
      <button
        onClick={onRemove}
        className="rounded p-0.5 opacity-60 hover:opacity-100"
        aria-label="Dismiss"
      >
        <XMarkIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
