/**
 * Client-side providers wrapper.
 *
 * Wraps all client-side context providers (TanStack Query, etc.)
 * so the root layout remains a Server Component.
 */

"use client";

import type { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { QueryProvider } from "@/lib/query-provider";
import { ToastContainer } from "@/components/ui/toast-container";
import { SessionExpiredModal } from "@/components/ui/session-expired-modal";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryProvider>
        {children}
        <ToastContainer />
        <SessionExpiredModal />
      </QueryProvider>
    </NextThemesProvider>
  );
}
