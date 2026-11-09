"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import { toast, ToastItem } from "@/lib/toast";

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const unsubscribe = toast.subscribe((newToast) => {
      setToasts((prev) => [...prev.slice(-4), newToast]); // Limit to max 5 visible toasts

      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          removeToast(newToast.id);
        }, newToast.duration);
      }
    });

    return unsubscribe;
  }, [removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 max-w-sm w-full pointer-events-none select-none">
      {toasts.map((item) => {
        const typeBorder = {
          success: "border-l-4 border-l-emerald-600",
          error: "border-l-4 border-l-destructive",
          warning: "border-l-4 border-l-amber-600",
          info: "border-l-4 border-l-primary",
        };

        const typeIcons = {
          success: <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
          error: <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />,
          warning: <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
          info: <Info className="size-4 text-primary shrink-0 mt-0.5" />,
        };

        return (
          <div
            key={item.id}
            className={`pointer-events-auto p-3.5 rounded-xl border border-border bg-card text-card-foreground shadow-xl flex items-start justify-between gap-3 animate-in slide-in-from-bottom-2 fade-in duration-150 ${typeBorder[item.type]}`}
          >
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              {typeIcons[item.type]}
              <div className="flex flex-col gap-0.5 min-w-0">
                {item.title && (
                  <span className="text-xs font-bold tracking-tight text-foreground">
                    {item.title}
                  </span>
                )}
                <span className="text-xs font-normal leading-snug text-muted-foreground break-words">
                  {item.message}
                </span>
                {item.actionLabel && item.onAction && (
                  <button
                    onClick={() => {
                      item.onAction?.();
                      removeToast(item.id);
                    }}
                    className="mt-1.5 text-xs font-semibold text-primary hover:underline self-start cursor-pointer"
                  >
                    {item.actionLabel}
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => removeToast(item.id)}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors cursor-pointer shrink-0"
              aria-label="Dismiss toast"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
