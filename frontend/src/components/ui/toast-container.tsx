"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import { toast, ToastItem } from "@/lib/toast";

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

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
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none">
      {toasts.map((item) => {
        const typeStyles = {
          success: "border-emerald-500/30 bg-emerald-500/10 text-foreground dark:bg-emerald-950/40 border-emerald-500/30",
          error: "border-rose-500/30 bg-rose-500/10 text-foreground dark:bg-rose-950/40 border-rose-500/30",
          warning: "border-amber-500/30 bg-amber-500/10 text-foreground dark:bg-amber-950/40 border-amber-500/30",
          info: "border-indigo-500/30 bg-indigo-500/10 text-foreground dark:bg-indigo-950/40 border-indigo-500/30",
        };

        const typeIcons = {
          success: <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />,
          error: <AlertCircle className="size-4 text-rose-500 shrink-0 mt-0.5" />,
          warning: <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />,
          info: <Info className="size-4 text-indigo-500 shrink-0 mt-0.5" />,
        };

        return (
          <div
            key={item.id}
            className={`pointer-events-auto p-4 rounded-2xl border backdrop-blur-xl shadow-xl flex items-start justify-between gap-3 animate-in slide-in-from-top-3 fade-in duration-200 transition-all ${typeStyles[item.type]}`}
          >
            <div className="flex items-start gap-3">
              {typeIcons[item.type]}
              <div className="flex flex-col gap-0.5">
                {item.title && (
                  <span className="text-xs font-bold tracking-tight text-foreground">
                    {item.title}
                  </span>
                )}
                <span className="text-xs font-medium leading-snug text-foreground/90">
                  {item.message}
                </span>
                {item.actionLabel && item.onAction && (
                  <button
                    onClick={() => {
                      item.onAction?.();
                      removeToast(item.id);
                    }}
                    className="mt-2 text-[11px] font-bold text-primary hover:underline self-start cursor-pointer"
                  >
                    {item.actionLabel}
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => removeToast(item.id)}
              className="text-muted-foreground/60 hover:text-foreground p-0.5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
