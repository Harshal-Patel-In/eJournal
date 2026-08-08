/**
 * Lightweight Liquid Glass Toast Notification Event Bus.
 *
 * Provides typed methods for triggering success, error, warning, and info toasts.
 */

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

type ToastListener = (toast: ToastItem) => void;

class ToastBus {
  private listeners: Set<ToastListener> = new Set();

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  show(toast: Omit<ToastItem, "id">) {
    const item: ToastItem = {
      ...toast,
      id: Math.random().toString(36).substring(2, 9),
      duration: toast.duration ?? 4000,
    };
    this.listeners.forEach((listener) => listener(item));
  }

  success(message: string, options?: Partial<Omit<ToastItem, "id" | "message" | "type">>) {
    this.show({ type: "success", message, ...options });
  }

  error(message: string, options?: Partial<Omit<ToastItem, "id" | "message" | "type">>) {
    this.show({ type: "error", message, duration: 6000, ...options });
  }

  warning(message: string, options?: Partial<Omit<ToastItem, "id" | "message" | "type">>) {
    this.show({ type: "warning", message, ...options });
  }

  info(message: string, options?: Partial<Omit<ToastItem, "id" | "message" | "type">>) {
    this.show({ type: "info", message, ...options });
  }
}

export const toast = new ToastBus();
