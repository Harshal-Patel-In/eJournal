"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Compass,
  ChevronRight,
  ChevronLeft,
  CircleArrowUp,
  Hash,
  Table as TableIcon,
  LineChart,
  Code as CodeIcon,
  CheckSquare,
  FileSymlink,
  BookOpen,
  Sigma,
  Image as ImageIcon,
} from "lucide-react";
import { useDocumentStore } from "./use-document-store";

export interface TocItem {
  id: string;
  label: string;
  depth: number;
  type: string;
}

const BASE = 8;
const RAIL_STEP = 8;
const TEXT_STEP = 12;
const MAX_LEVEL = 2;
const BRIDGE = 6;

const levelOf = (depth: number) => Math.min(Math.max(depth - 2, 0), MAX_LEVEL);
const lineOffset = (depth: number) => BASE + levelOf(depth) * RAIL_STEP;
const textOffset = (depth: number) => BASE + (levelOf(depth) + 1) * TEXT_STEP;

// Mathematical Stepped Rail Component with Bezier Bridge Turns
const Rail = ({
  depth,
  prevDepth = depth,
  nextDepth = depth,
  isActive,
}: {
  depth: number;
  prevDepth?: number;
  nextDepth?: number;
  isActive?: boolean;
}) => {
  const line = lineOffset(depth);
  const prevLine = lineOffset(prevDepth);
  const nextLine = lineOffset(nextDepth);
  const turns = prevLine !== line;

  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute left-0 z-0 overflow-visible stroke-1 transition-colors duration-150 ease-out ${
        isActive
          ? "stroke-blue-500 dark:stroke-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]"
          : "stroke-border/70 dark:stroke-white/15"
      }`}
      fill="none"
      style={{
        height: line === nextLine ? `calc(100% + ${BRIDGE}px)` : "100%",
        top: -BRIDGE,
        width: Math.max(prevLine, line) + 9,
      }}
    >
      {turns ? (
        <path
          d={`M ${prevLine + 0.5} 0 C ${prevLine + 0.5} 8 ${line + 0.5} 4 ${line + 0.5} ${BRIDGE * 2}`}
        />
      ) : null}
      <line
        x1={line + 0.5}
        x2={line + 0.5}
        y1={turns ? BRIDGE * 2 : BRIDGE}
        y2="100%"
      />
    </svg>
  );
};

const SCROLL_OFFSET = 100;

// Color accent definitions for outline items
const getItemColor = (type: string) => {
  switch (type) {
    case "table":
      return {
        bg: "bg-emerald-500",
        glow: "shadow-[0_0_8px_rgba(16,185,129,0.9)]",
        border: "border-emerald-500/40",
        text: "text-emerald-500 dark:text-emerald-400",
        badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
        dot: "bg-emerald-500",
      };
    case "graph":
      return {
        bg: "bg-cyan-500",
        glow: "shadow-[0_0_8px_rgba(6,182,212,0.9)]",
        border: "border-cyan-500/40",
        text: "text-cyan-500 dark:text-cyan-400",
        badge: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/25",
        dot: "bg-cyan-500",
      };
    case "code":
      return {
        bg: "bg-violet-500",
        glow: "shadow-[0_0_8px_rgba(139,92,246,0.9)]",
        border: "border-violet-500/40",
        text: "text-violet-500 dark:text-violet-400",
        badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25",
        dot: "bg-violet-500",
      };
    case "equation":
      return {
        bg: "bg-fuchsia-500",
        glow: "shadow-[0_0_8px_rgba(217,70,239,0.9)]",
        border: "border-fuchsia-500/40",
        text: "text-fuchsia-500 dark:text-fuchsia-400",
        badge: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/25",
        dot: "bg-fuchsia-500",
      };
    case "image":
      return {
        bg: "bg-sky-500",
        glow: "shadow-[0_0_8px_rgba(14,165,233,0.9)]",
        border: "border-sky-500/40",
        text: "text-sky-500 dark:text-sky-400",
        badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25",
        dot: "bg-sky-500",
      };
    case "observation":
      return {
        bg: "bg-amber-500",
        glow: "shadow-[0_0_8px_rgba(245,158,11,0.9)]",
        border: "border-amber-500/40",
        text: "text-amber-500 dark:text-amber-400",
        badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
        dot: "bg-amber-500",
      };
    case "result":
      return {
        bg: "bg-emerald-500",
        glow: "shadow-[0_0_8px_rgba(16,185,129,0.9)]",
        border: "border-emerald-500/40",
        text: "text-emerald-500 dark:text-emerald-400",
        badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
        dot: "bg-emerald-500",
      };
    case "reference":
      return {
        bg: "bg-rose-500",
        glow: "shadow-[0_0_8px_rgba(244,63,94,0.9)]",
        border: "border-rose-500/40",
        text: "text-rose-500 dark:text-rose-400",
        badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25",
        dot: "bg-rose-500",
      };
    default:
      return {
        bg: "bg-blue-500",
        glow: "shadow-[0_0_8px_rgba(59,130,246,0.9)]",
        border: "border-blue-500/40",
        text: "text-blue-500 dark:text-blue-400",
        badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25",
        dot: "bg-blue-500",
      };
  }
};

interface TableOfContentsProps {
  isInlineSticky?: boolean;
  position?: "left" | "right";
}

export default function TableOfContents({
  isInlineSticky = false,
  position = "right",
}: TableOfContentsProps = {}) {
  const { blocks, title } = useDocumentStore();
  const [collapsed, setCollapsed] = useState(false);
  const [activeId, setActiveId] = useState<string>("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Portal safety for client-side tooltips
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Programmatic scroll lock and click-target tracking refs
  const isProgrammaticScrollRef = useRef(false);
  const targetActiveIdRef = useRef<string | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Item DOM refs for calculating sliding liquid pill position
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{ top: number; height: number; opacity: number }>({
    top: 0,
    height: 0,
    opacity: 0,
  });

  // Dynamic Liquid Glass Scrubbing Tooltip for Collapsed Minimap Spine
  const [tooltipItem, setTooltipItem] = useState<TocItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const isTooltipActiveRef = useRef(false);
  const tooltipTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleDashMouseEnter = (e: React.MouseEvent<HTMLElement>, item: TocItem) => {
    if (tooltipHideTimerRef.current) clearTimeout(tooltipHideTimerRef.current);
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);

    const rect = e.currentTarget.getBoundingClientRect();
    const targetPos =
      position === "left"
        ? { top: rect.top + rect.height / 2, left: rect.right + 12 }
        : { top: rect.top + rect.height / 2, left: rect.left - 10 };

    if (isTooltipActiveRef.current) {
      setTooltipPos(targetPos);
      setTooltipItem(item);
    } else {
      tooltipTimerRef.current = setTimeout(() => {
        setTooltipPos(targetPos);
        setTooltipItem(item);
        isTooltipActiveRef.current = true;
      }, 140);
    }
  };

  const handleDashMouseLeave = () => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipHideTimerRef.current = setTimeout(() => {
      setTooltipItem(null);
      setTooltipPos(null);
      isTooltipActiveRef.current = false;
    }, 140);
  };

  // Auto-collapse rail on compact laptop displays to preserve writing canvas
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1440) {
      setCollapsed(true);
    }
  }, []);

  // Dynamically extract outline items directly from reactive Zustand store
  const items = useMemo(() => {
    const list: TocItem[] = [];

    if (title && title.trim()) {
      list.push({
        id: "journal-title-header",
        label: title.trim(),
        depth: 2,
        type: "title",
      });
    }

    for (const block of blocks) {
      if (block.type === "heading") {
        const level = Number(block.content?.level) || 1;
        const text = (block.content?.text || "").trim();
        list.push({
          id: block.id,
          label: text || `Heading ${level}`,
          depth: Math.min(level + 1, 4),
          type: "heading",
        });
      } else if (block.type === "table") {
        list.push({
          id: block.id,
          label: block.content?.title || "Data Table",
          depth: 3,
          type: "table",
        });
      } else if (block.type === "graph") {
        list.push({
          id: block.id,
          label: block.content?.title || "Graph Plot",
          depth: 3,
          type: "graph",
        });
      } else if (block.type === "code") {
        const lang = block.content?.language || "Snippet";
        list.push({
          id: block.id,
          label: `Code (${lang})`,
          depth: 3,
          type: "code",
        });
      } else if (block.type === "equation") {
        const latex = (block.content?.latex || "").trim();
        list.push({
          id: block.id,
          label: latex ? `Formula: ${latex.slice(0, 24)}${latex.length > 24 ? "…" : ""}` : "Math Equation",
          depth: 3,
          type: "equation",
        });
      } else if (block.type === "image") {
        const caption = (block.content?.caption || "").trim();
        list.push({
          id: block.id,
          label: caption || "Figure / Image",
          depth: 3,
          type: "image",
        });
      } else if (block.type === "observation") {
        list.push({
          id: block.id,
          label: "Observation Record",
          depth: 3,
          type: "observation",
        });
      } else if (block.type === "result") {
        list.push({
          id: block.id,
          label: "Result Statement",
          depth: 2,
          type: "result",
        });
      } else if (block.type === "reference") {
        list.push({
          id: block.id,
          label: "References",
          depth: 3,
          type: "reference",
        });
      }
    }

    return list;
  }, [blocks, title]);

  // Default active item to first item on load
  useEffect(() => {
    if (!activeId && items.length > 0) {
      setActiveId(items[0].id);
    }
  }, [items, activeId]);

  // Update sliding indicator pill position
  const updatePillPosition = useCallback(() => {
    if (!activeId || !itemRefs.current[activeId] || !containerRef.current) {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }

    const container = containerRef.current;
    const el = itemRefs.current[activeId];
    if (container && el) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const top = elRect.top - containerRect.top;
      const height = elRect.height;
      setIndicatorStyle({
        top,
        height,
        opacity: 1,
      });

      // Safely ensure active item stays visible in scrollable TOC rail without hijacking window scroll
      const scrollParent = el.closest(".custom-scrollbar") as HTMLElement | null;
      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        if (elRect.bottom > parentRect.bottom) {
          scrollParent.scrollTop += elRect.bottom - parentRect.bottom + 8;
        } else if (elRect.top < parentRect.top) {
          scrollParent.scrollTop -= parentRect.top - elRect.top + 8;
        }
      }
    }
  }, [activeId]);

  useEffect(() => {
    updatePillPosition();
    window.addEventListener("resize", updatePillPosition);
    return () => window.removeEventListener("resize", updatePillPosition);
  }, [updatePillPosition]);

  // Scroll spy: section-range resolution matching standard TOC library architecture
  const handleScroll = useCallback(() => {
    const scrollY = window.scrollY;
    setShowScrollTop(scrollY > 250);

    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const maxScroll = documentHeight - windowHeight;
    const pct = maxScroll > 0 ? Math.min(100, Math.max(0, Math.round((scrollY / maxScroll) * 100))) : 0;
    setScrollProgress(pct);

    // Mute scroll spy during programmatic smooth scrolling from clicks
    if (isProgrammaticScrollRef.current) return;
    if (items.length === 0) return;

    const isAtBottom = windowHeight + scrollY >= documentHeight - 40;

    // 1. DOCUMENT TOP
    if (scrollY < 60) {
      setActiveId(items[0].id);
      return;
    }

    // 2. BOTTOM-OF-PAGE EDGE CONDITION:
    // If the user has scrolled to the document floor, trailing blocks cannot reach SCROLL_OFFSET.
    // Preserve the clicked target if visible, or select the lowest visible item in viewport.
    if (isAtBottom) {
      if (targetActiveIdRef.current) {
        const targetEl = document.getElementById(`block-${targetActiveIdRef.current}`);
        if (targetEl) {
          const rect = targetEl.getBoundingClientRect();
          if (rect.top < windowHeight && rect.bottom > 0) {
            setActiveId(targetActiveIdRef.current);
            return;
          }
        }
      }

      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (item.id === "journal-title-header") continue;
        const el = document.getElementById(`block-${item.id}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top < windowHeight && rect.bottom > 64) {
            setActiveId(item.id);
            return;
          }
        }
      }
      setActiveId(items[items.length - 1].id);
      return;
    }

    // 3. TARGET LOCK & ACTIVE TARGET RESOLUTION:
    if (targetActiveIdRef.current) {
      const targetEl = document.getElementById(`block-${targetActiveIdRef.current}`);
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        // If the targeted block is currently landing or positioned in view
        if (rect.top <= SCROLL_OFFSET + 70 && rect.bottom >= SCROLL_OFFSET - 20) {
          setActiveId(targetActiveIdRef.current);
          return;
        }
      }
    }

    // 4. NATURAL READING ZONE RESOLUTION:
    // Sections activate as soon as they reach the upper reading zone (~32% of the viewport).
    // This allows blocks to activate smoothly while fully visible in view, rather than forcing
    // them to scroll all the way into the cramped top 100px line under the header.
    const scrollTriggerOffset = Math.max(SCROLL_OFFSET + 50, Math.round(windowHeight * 0.32));
    const triggerY = scrollY + scrollTriggerOffset;
    let activeSectionId = items[0].id;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.id === "journal-title-header") continue;

      const el = document.getElementById(`block-${item.id}`);
      if (el) {
        const elTop = el.getBoundingClientRect().top + scrollY;

        if (triggerY >= elTop) {
          activeSectionId = item.id;
        } else {
          // Because items are in vertical DOM sequence,
          // the first block whose top is beyond triggerY marks the end of the previous section!
          break;
        }
      }
    }

    setActiveId(activeSectionId);
  }, [items]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    const onScrollEnd = () => {
      isProgrammaticScrollRef.current = false;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      handleScroll();
    };

    const onUserInteract = () => {
      // Manual mouse wheel or touch immediately releases programmatic lock
      isProgrammaticScrollRef.current = false;
      targetActiveIdRef.current = null;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };

    window.addEventListener("scrollend", onScrollEnd);
    window.addEventListener("wheel", onUserInteract, { passive: true });
    window.addEventListener("touchmove", onUserInteract, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scrollend", onScrollEnd);
      window.removeEventListener("wheel", onUserInteract);
      window.removeEventListener("touchmove", onUserInteract);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [handleScroll]);

  // Scroll to targeted item smoothly with lock and target tracking
  const scrollToItem = (id: string) => {
    targetActiveIdRef.current = id;
    setActiveId(id);
    isProgrammaticScrollRef.current = true;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Safety fallback: release lock after smooth scroll settles
    scrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      handleScroll();
    }, 800);

    if (id === "journal-title-header") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const el = document.getElementById(`block-${id}`);
    if (el) {
      const y = el.getBoundingClientRect().top + window.pageYOffset - SCROLL_OFFSET;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case "table":
        return <TableIcon className="size-3 text-emerald-500 shrink-0" />;
      case "graph":
        return <LineChart className="size-3 text-cyan-500 shrink-0" />;
      case "code":
        return <CodeIcon className="size-3 text-violet-500 shrink-0" />;
      case "equation":
        return <Sigma className="size-3 text-fuchsia-500 shrink-0" />;
      case "image":
        return <ImageIcon className="size-3 text-sky-500 shrink-0" />;
      case "observation":
        return <FileSymlink className="size-3 text-amber-500 shrink-0" />;
      case "result":
        return <CheckSquare className="size-3 text-emerald-500 shrink-0" />;
      case "reference":
        return <BookOpen className="size-3 text-rose-500 shrink-0" />;
      default:
        return null;
    }
  };

  // If there are no outline items in the document yet, keep it invisible
  if (items.length === 0) return null;

  return (
    <aside
      aria-label="Table of Contents"
      className={
        isInlineSticky
          ? `sticky top-20 z-20 hidden xl:flex flex-col select-none transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] print:hidden shrink-0 self-start ${
              collapsed ? "w-12" : "w-56"
            }`
          : position === "left"
          ? `fixed top-24 z-30 hidden xl:flex flex-col select-none transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] left-6 xl:left-8 2xl:left-[calc(50vw-448px-230px)] print:hidden ${
              collapsed ? "w-12" : "w-56"
            }`
          : `fixed top-24 z-30 hidden xl:flex flex-col select-none transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] right-6 xl:right-8 2xl:right-[calc(50vw-448px-248px)] print:hidden ${
              collapsed ? "w-12" : "w-56"
            }`
      }
    >
      {/* Liquid Glass Shell Container with Apple Specular Bevel */}
      <div
        className={`relative flex flex-col rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${
          collapsed
            ? "py-2 px-1.5 items-center bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl backdrop-saturate-150 border border-border/70 dark:border-white/10 ring-1 ring-black/5 dark:ring-white/5 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.07),_inset_0_1px_1px_rgba(255,255,255,0.85)] dark:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.5),_inset_0_1px_1px_rgba(255,255,255,0.1)] opacity-85 hover:opacity-100 focus-within:opacity-100"
            : "bg-gradient-to-b from-white/95 via-white/85 to-white/75 dark:from-zinc-900/95 dark:via-zinc-900/90 dark:to-zinc-950/85 backdrop-blur-2xl backdrop-saturate-180 border border-white/80 dark:border-white/15 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.12),_inset_0_1px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7),_inset_0_1px_1px_rgba(255,255,255,0.18)] opacity-100"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center transition-colors duration-200 ${
            collapsed
              ? "justify-center pt-0.5 pb-1 w-full"
              : "justify-between px-2.5 py-1.5 border-b border-border/50 bg-muted/20"
          }`}
        >
          {!collapsed ? (
            <div className="flex items-center gap-1.5 font-bold text-xs text-foreground tracking-tight">
              <div className="p-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Compass className="size-3.5" />
              </div>
              <span>Outline</span>
              <span className="text-[10px] font-mono text-muted-foreground/60 font-semibold px-1.5 py-0.5 rounded-full bg-muted/40">
                {items.length}
              </span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand Outline" : "Collapse Outline"}
            title={collapsed ? "Expand Outline" : "Collapse to Minimap Spine"}
            className={
              collapsed
                ? "group/nav size-6 flex items-center justify-center rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer active:scale-90"
                : "p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all cursor-pointer"
            }
          >
            {collapsed ? (
              position === "left" ? (
                <ChevronRight className="size-3.5 transition-transform duration-200 group-hover/nav:translate-x-0.5" />
              ) : (
                <ChevronLeft className="size-3.5 transition-transform duration-200 group-hover/nav:-translate-x-0.5" />
              )
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        </div>

        {/* Outline Content */}
        {!collapsed ? (
          <div className="p-2 flex flex-col gap-1 max-h-[calc(100vh-160px)] overflow-y-auto overflow-x-hidden custom-scrollbar">
            <div ref={containerRef} className="relative flex flex-col">
              {/* Hardware-Accelerated Sliding Liquid Pill Indicator */}
              <div
                aria-hidden="true"
                className="absolute left-0 right-0 rounded-lg bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/25 pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-0"
                style={{
                  transform: `translateY(${indicatorStyle.top}px)`,
                  height: `${indicatorStyle.height}px`,
                  opacity: indicatorStyle.opacity,
                }}
              />

              {items.map((item, idx) => {
                const isActive = activeId === item.id;
                const prevItem = items[idx - 1];
                const nextItem = items[idx + 1];

                return (
                  <div key={item.id} className="w-full flex items-center">
                    <button
                      ref={(el) => {
                        itemRefs.current[item.id] = el;
                      }}
                      type="button"
                      onClick={() => scrollToItem(item.id)}
                      style={{ paddingLeft: textOffset(item.depth) }}
                      className={`relative z-10 flex items-center gap-1.5 w-full py-1.5 pr-2 rounded-lg text-left transition-colors duration-200 cursor-pointer ${
                        isActive
                          ? "font-semibold text-blue-600 dark:text-blue-400"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30 font-medium"
                      }`}
                    >
                      {/* Mathematical Stepped Rail Connector */}
                      <Rail
                        depth={item.depth}
                        prevDepth={prevItem ? prevItem.depth : item.depth}
                        nextDepth={nextItem ? nextItem.depth : item.depth}
                        isActive={isActive}
                      />

                      {/* Optional semantic block icon */}
                      {getItemIcon(item.type)}

                      <span className="text-xs truncate tracking-tight">
                        {item.label}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Scroll-to-Top Action Button */}
            {showScrollTop && (
              <div className="pt-2 mt-1 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all cursor-pointer"
                >
                  <CircleArrowUp className="size-3.5 text-blue-500" />
                  <span>Scroll to Top</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Calm Liquid Glass Minimap Spine */
          <div className="relative w-full flex flex-col items-center py-1 max-h-[calc(100vh-160px)]">
            {/* Scrollable Node Rail */}
            <div className="relative z-10 flex flex-col items-center w-full max-h-[calc(100vh-215px)] overflow-y-auto no-scrollbar py-0.5 gap-0.5">
              {items.map((item) => {
                const isActive = activeId === item.id;
                const isHovered = tooltipItem?.id === item.id;
                const isHighlighted = isActive || isHovered;
                const accent = getItemColor(item.type);

                // Unified Cohesive Micro-Bar Hierarchy (All Micro-Bars, No Random Circles):
                // Level 1 (Depth 2: Document Title, H1, Result): 24px wide x 4px tall
                // Level 2 (Depth 3: H2, Tables, Equations, Images, Code, Observation): 16px wide x 4px tall
                // Level 3 (Depth 4+: H3 subsections, Reference): 10px wide x 4px tall
                const barWidth =
                  item.depth === 2
                    ? "w-6"
                    : item.depth === 3
                    ? "w-4"
                    : "w-2.5";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToItem(item.id)}
                    onMouseEnter={(e) => handleDashMouseEnter(e, item)}
                    onMouseLeave={handleDashMouseLeave}
                    className="relative py-1 flex items-center justify-center w-full cursor-pointer group/node"
                    aria-label={item.label}
                  >
                    <span
                      className={`h-1 rounded-full transition-all duration-200 ease-out ${barWidth} ${
                        isHighlighted
                          ? `${accent.bg} ${accent.glow} scale-y-125 ring-2 ring-blue-500/25 shadow-sm`
                          : "bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 dark:hover:bg-zinc-400"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Bottom Progress & Scroll-to-Top Action */}
            <div className="relative z-10 pt-1.5 pb-1 w-full flex flex-col items-center justify-center gap-1 border-t border-border/40 mt-1">
              {/* Circular SVG Progress Ring */}
              <div
                className="relative size-5 flex items-center justify-center"
                title={`Reading Progress: ${scrollProgress}%`}
              >
                <svg className="size-full -rotate-90" viewBox="0 0 24 24">
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    className="stroke-border/50 dark:stroke-white/10 fill-none stroke-[2.5]"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    className="stroke-blue-500 dark:stroke-blue-400 fill-none stroke-[2.5] transition-all duration-300 ease-out"
                    strokeDasharray={56.5}
                    strokeDashoffset={56.5 - (56.5 * scrollProgress) / 100}
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <span className="text-[9px] font-mono font-bold text-muted-foreground/80 select-none tabular-nums tracking-tight">
                {scrollProgress}%
              </span>

              {/* Dedicated Scroll-to-Top Button */}
              {showScrollTop && (
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  aria-label="Scroll to top"
                  title="Scroll to top"
                  className="size-6 rounded-full hover:bg-muted text-muted-foreground hover:text-blue-500 flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer animate-in fade-in-0 zoom-in-95 mt-0.5"
                >
                  <CircleArrowUp className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* DYNAMIC SCRUBBING LIQUID GLASS TOOLTIP FOR COLLAPSED MINIMAP SPINE */}
      {mounted && collapsed && tooltipItem && tooltipPos && createPortal(
        <div
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
          className={`fixed z-[9999] px-3 py-1.5 rounded-xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border ${
            getItemColor(tooltipItem.type).border
          } ring-1 ring-black/5 dark:ring-white/10 shadow-[0_12px_28px_-6px_rgba(0,0,0,0.18),_inset_0_1px_1px_rgba(255,255,255,0.2)] flex items-center gap-2 select-none pointer-events-none transition-all duration-100 ease-out animate-in fade-in-0 zoom-in-95 ${
            position === "left" ? "-translate-y-1/2" : "-translate-x-full -translate-y-1/2"
          }`}
        >
          {/* Chromatic Category Icon Chip */}
          <div
            className={`p-1 rounded-lg border ${
              getItemColor(tooltipItem.type).badge
            } shadow-xs shrink-0 flex items-center justify-center`}
          >
            {getItemIcon(tooltipItem.type) || <Hash className="size-3 text-blue-500" />}
          </div>

          {/* Label and Subtitle Metadata */}
          <div className="flex flex-col min-w-0 pr-0.5">
            <span className="text-xs font-semibold text-foreground whitespace-nowrap max-w-[190px] truncate leading-tight">
              {tooltipItem.label}
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground/80 tracking-wide uppercase mt-0.5 flex items-center gap-1">
              <span className={getItemColor(tooltipItem.type).text}>
                {tooltipItem.type}
              </span>
            </span>
          </div>

          {/* Micro Caret Arrow pointing toward spine */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 size-1.5 rotate-45 bg-white dark:bg-zinc-900 ${
              position === "left"
                ? `left-[-3px] border-b border-l ${getItemColor(tooltipItem.type).border}`
                : `right-[-3px] border-t border-r ${getItemColor(tooltipItem.type).border}`
            }`}
          />
        </div>,
        document.body
      )}
    </aside>
  );
}
