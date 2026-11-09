"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Lock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SessionExpiredModal() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const isAuthPage = pathname?.startsWith("/auth") || pathname === "/";

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsOpen(false);
  }

  useEffect(() => {
    function handleUnauthorized() {
      if (
        !isAuthPage &&
        typeof window !== "undefined" &&
        !(window as unknown as { __IS_LOGGING_OUT?: boolean }).__IS_LOGGING_OUT
      ) {
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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-md bg-card text-card-foreground rounded-lg border border-border p-6 shadow-xl flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
            <Lock className="size-4" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-foreground">Session expired</h3>
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
            className="gap-2 font-semibold h-8 px-4 cursor-pointer"
          >
            <LogIn className="size-3.5" />
            <span>Log in again</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
