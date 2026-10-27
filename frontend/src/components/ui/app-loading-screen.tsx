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
      {/* Ambient Theme Radial Glow */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="size-[380px] sm:size-[460px] rounded-full bg-primary/10 dark:bg-primary/15 blur-[100px] animate-pulse" />
      </div>

      {/* Frosted Glass Capsule */}
      <div className="relative z-10 mx-4 w-full max-w-[340px] rounded-3xl bg-card/85 dark:bg-zinc-900/85 backdrop-blur-2xl backdrop-saturate-180 border border-border/70 dark:border-white/10 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.12),0_4px_16px_-4px_rgba(0,0,0,0.06)] dark:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.08)] p-7 flex flex-col items-center text-center transition-all">
        {/* Brand Icon with Radiant Ring */}
        <div className="relative mb-5 flex items-center justify-center">
          <div className="absolute -inset-2 rounded-2xl bg-primary/10 dark:bg-primary/20 blur-md animate-pulse" />
          <div className="relative size-14 rounded-2xl bg-background/80 dark:bg-zinc-800/80 border border-border/60 dark:border-white/10 flex items-center justify-center shadow-sm p-2">
            <Image
              src="/logo.png"
              alt="eJournal Logo"
              width={40}
              height={40}
              priority
              style={{ width: "auto", height: "auto" }}
              className="size-10 object-contain drop-shadow-sm transition-transform duration-700 hover:scale-105"
            />
          </div>
        </div>

        {/* Informative Typography */}
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-[260px]">
            {subtitle}
          </p>
        )}

        {/* Hardware-Accelerated Progress Track */}
        <div
          className="w-44 h-1 bg-muted dark:bg-zinc-800 rounded-full overflow-hidden mt-5 relative ring-1 ring-border/40"
          aria-hidden="true"
        >
          <div className="h-full w-2/5 bg-gradient-to-r from-primary/70 via-primary to-primary/70 rounded-full animate-indeterminate-slide" />
        </div>

        {/* Micro-Brand Subtext */}
        <div className="mt-4 flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase text-muted-foreground/60">
          <span className="size-1 rounded-full bg-primary/70 animate-ping inline-block" />
          <span>eJournal Academic Engine</span>
        </div>
      </div>
    </div>
  );
}
