"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Lock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SessionExpiredModal() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const isAuthPage = pathname?.startsWith("/auth") || pathname === "/";

  useEffect(() => {
    // Reset modal visibility on route changes
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleUnauthorized() {
      if (!isAuthPage && typeof window !== "undefined" && !(window as any).__IS_LOGGING_OUT) {
        setIsOpen(true);
      }
    }
    window.addEventListener("unauthorized", handleUnauthorized);
    return () => window.removeEventListener("unauthorized", handleUnauthorized);
  }, [isAuthPage]);

  const handleLoginRedirect = () => {
    setIsOpen(false);
    window.location.href = "/auth/login";
  };

  if (!isOpen || isAuthPage) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-background dark:bg-zinc-900 rounded-3xl border border-amber-500/30 p-6 shadow-2xl flex flex-col gap-5 select-none">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
            <Lock className="size-5" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-base font-bold text-foreground">Session Expired</h3>
            <span className="text-xs text-muted-foreground">Authentication required</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Your session expired after 15 minutes of inactivity. Any active local edits have been backed up in local storage. Please log in again to continue working.
        </p>

        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            onClick={handleLoginRedirect}
            className="gap-2 font-semibold glass-btn-amber h-9 px-5 rounded-xl cursor-pointer"
          >
            <LogIn className="size-4" />
            <span>Log In Again</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
