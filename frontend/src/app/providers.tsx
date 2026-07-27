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

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryProvider>{children}</QueryProvider>
    </NextThemesProvider>
  );
}
