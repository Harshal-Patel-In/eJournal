"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";

interface TooltipState {
  visible: boolean;
  content: string;
  subtext?: string;
  shortcut?: string;
  x: number;
  y: number;
  side: "top" | "bottom";
}

/**
 * LiquidTooltipProvider
 * 
 * Global hardware-accelerated Apple Liquid Glass tooltip manager.
 * Intercepts [data-tooltip] and existing [title] attributes on interactive elements,
 * suppressing the unstyled OS default black boxes and replacing them with
 * frosted micro-pill tooltips with warm grouping and keyboard shortcut badges.
 */
export function LiquidTooltipProvider() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const showTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeElementRef = useRef<HTMLElement | null>(null);
  const lastActiveTimestampRef = useRef<number>(0);
  const tooltipElementRef = useRef<HTMLDivElement | null>(null);

  const hideTooltip = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setTooltip(null);
    activeElementRef.current = null;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Suppress tooltips on touch devices
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (!isFinePointer) return;

    const findTooltipTarget = (target: HTMLElement | null): HTMLElement | null => {
      let el: HTMLElement | null = target;
      let depth = 0;
      while (el && depth < 5 && el !== document.body) {
        if (
          el.hasAttribute("data-tooltip") ||
          el.hasAttribute("title") ||
          el.hasAttribute("data-tooltip-raw")
        ) {
          return el;
        }
        el = el.parentElement;
        depth++;
      }
      return null;
    };

    const parseTooltipText = (rawText: string) => {
      let content = rawText.trim();
      let subtext: string | undefined = undefined;
      let shortcut: string | undefined = undefined;

      // Extract shortcut pattern like "(Shift + [)" or "(Ctrl + S)" or "(Esc)"
      const shortcutMatch = content.match(/\(([^)]*(?:Ctrl|Shift|Alt|⌘|Option|Esc|\+|\[|\])[^)]*)\)$/i);
      if (shortcutMatch) {
        shortcut = shortcutMatch[1].trim();
        content = content.replace(/\s*\([^)]+\)$/, "").trim();
      }

      // Extract subtitle separator " — " or " – "
      if (content.includes(" — ")) {
        const parts = content.split(" — ");
        content = parts[0].trim();
        subtext = parts.slice(1).join(" — ").trim();
      } else if (content.includes(" – ")) {
        const parts = content.split(" – ");
        content = parts[0].trim();
        subtext = parts.slice(1).join(" – ").trim();
      }

      return { content, subtext, shortcut };
    };

    const handleMouseEnter = (e: MouseEvent) => {
      const target = findTooltipTarget(e.target as HTMLElement);
      if (!target) return;

      // Capture and suppress native browser title attribute so OS black box never triggers
      if (target.hasAttribute("title")) {
        const titleVal = target.getAttribute("title") || "";
        if (titleVal) {
          target.setAttribute("data-tooltip-raw", titleVal);
          // Set aria-label for accessibility if not present
          if (!target.hasAttribute("aria-label")) {
            target.setAttribute("aria-label", titleVal);
          }
        }
        target.removeAttribute("title");
      }

      const rawContent = target.getAttribute("data-tooltip") || target.getAttribute("data-tooltip-raw");
      if (!rawContent) return;

      const customSubtext = target.getAttribute("data-tooltip-subtext") || undefined;
      const customShortcut = target.getAttribute("data-tooltip-shortcut") || undefined;
      const explicitSide = target.getAttribute("data-tooltip-side") as "top" | "bottom" | null;

      const parsed = parseTooltipText(rawContent);
      const finalContent = parsed.content;
      const finalSubtext = customSubtext || parsed.subtext;
      const finalShortcut = customShortcut || parsed.shortcut;

      if (!finalContent) return;

      activeElementRef.current = target;

      // Emil Kowalski Warm Grouping:
      // If user recently hovered another tooltip (<350ms ago), open instantly (0ms)
      const now = Date.now();
      const isWarm = now - lastActiveTimestampRef.current < 350;
      const delay = isWarm ? 0 : 140;

      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

      showTimerRef.current = setTimeout(() => {
        if (activeElementRef.current !== target) return;

        const rect = target.getBoundingClientRect();
        // Determine side (default to top, flip to bottom if too close to ceiling)
        const side = explicitSide || (rect.top < 44 ? "bottom" : "top");
        const rawCenterX = rect.left + rect.width / 2;
        // Clamp center point so tooltip never clips against viewport margins
        const margin = 72;
        const centerX = Math.max(margin, Math.min(window.innerWidth - margin, rawCenterX));
        const targetY = side === "top" ? rect.top - 6 : rect.bottom + 6;

        setTooltip({
          visible: true,
          content: finalContent,
          subtext: finalSubtext,
          shortcut: finalShortcut,
          x: centerX,
          y: targetY,
          side,
        });

        lastActiveTimestampRef.current = Date.now();
      }, delay);
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = findTooltipTarget(e.target as HTMLElement);
      if (target && target === activeElementRef.current) {
        lastActiveTimestampRef.current = Date.now();
        hideTooltip();
      }
    };

    const handleDismiss = () => {
      hideTooltip();
    };

    document.addEventListener("mouseover", handleMouseEnter, true);
    document.addEventListener("mouseout", handleMouseLeave, true);
    document.addEventListener("mousedown", handleDismiss, true);
    document.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("blur", handleDismiss);

    return () => {
      document.removeEventListener("mouseover", handleMouseEnter, true);
      document.removeEventListener("mouseout", handleMouseLeave, true);
      document.removeEventListener("mousedown", handleDismiss, true);
      document.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("blur", handleDismiss);
    };
  }, [hideTooltip]);

  if (!tooltip || !tooltip.visible) return null;

  return (
    <div
      style={{
        left: `${tooltip.x}px`,
        top: `${tooltip.y}px`,
      }}
      className={`fixed z-[99999] pointer-events-none select-none flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium tracking-tight text-white bg-zinc-900/90 dark:bg-zinc-900/95 backdrop-blur-xl border border-white/15 dark:border-white/20 shadow-xl shadow-black/35 whitespace-nowrap ${
        tooltip.side === "top" ? "animate-liquid-tooltip-top" : "animate-liquid-tooltip-bottom"
      }`}
    >
      <span className="font-semibold text-[11px] text-zinc-100 leading-none">
        {tooltip.content}
      </span>

      {tooltip.subtext && (
        <span className="text-[10px] text-zinc-400 font-normal border-l border-white/15 pl-1.5 leading-none">
          {tooltip.subtext}
        </span>
      )}

      {tooltip.shortcut && (
        <kbd className="px-1.5 py-0.5 rounded bg-white/15 dark:bg-white/10 border border-white/10 text-[9.5px] font-mono font-medium text-zinc-300 ml-0.5 shrink-0 leading-none">
          {tooltip.shortcut}
        </kbd>
      )}
    </div>
  );
}

interface LiquidTooltipProps {
  content: string;
  subtext?: string;
  shortcut?: string;
  side?: "top" | "bottom";
  children: React.ReactElement;
  disabled?: boolean;
}

/**
 * LiquidTooltip
 * Explicit wrapper for interactive components.
 */
export function LiquidTooltip({
  content,
  subtext,
  shortcut,
  side = "top",
  children,
  disabled = false,
}: LiquidTooltipProps) {
  if (disabled) return children;

  return React.cloneElement(children, {
    "data-tooltip": content,
    ...(subtext ? { "data-tooltip-subtext": subtext } : {}),
    ...(shortcut ? { "data-tooltip-shortcut": shortcut } : {}),
    ...(side ? { "data-tooltip-side": side } : {}),
  } as React.HTMLAttributes<HTMLElement>);
}
