"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface AppLoadingScreenProps {
  title?: string;
  subtitle?: string;
  className?: string;
  fullScreen?: boolean;
}

export function AppLoadingScreen({
  title = "Loading Workspace...",
  subtitle = "Preparing academic documents & mathematical blocks...",
  className,
  fullScreen = true,
}: AppLoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={title}
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden bg-background select-none",
        fullScreen ? "fixed inset-0 z-50 min-h-screen w-screen" : "w-full py-16",
        className
      )}
    >
      {/* Almanac Clean Paper Ground */}
      <div className="relative z-10 mx-4 w-full max-w-[340px] rounded-lg bg-card border border-border shadow-md p-6 flex flex-col items-center text-center">
        {/* Brand Icon */}
        <div className="mb-4 flex items-center justify-center">
          <div className="size-12 rounded-md bg-muted border border-border flex items-center justify-center p-2">
            <Image
              src="/logo.png"
              alt="eJournal Logo"
              width={36}
              height={36}
              priority
              style={{ width: "auto", height: "auto" }}
              className="size-8 object-contain"
            />
          </div>
        </div>

        {/* Informative Typography */}
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-[260px]">
            {subtitle}
          </p>
        )}

        {/* Hardware-Accelerated Progress Track */}
        <div
          className="w-40 h-1 bg-muted rounded-full overflow-hidden mt-4 relative border border-border/60"
          aria-hidden="true"
        >
          <div className="h-full w-2/5 bg-primary rounded-full animate-indeterminate-slide" />
        </div>

        {/* Micro-Brand Subtext */}
        <div className="mt-3.5 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
          <span className="size-1 rounded-full bg-primary inline-block" />
          <span>eJournal Academic Engine</span>
        </div>
      </div>
    </div>
  );
}
