"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Heading } from "lucide-react";
import {
  CATEGORIES,
  HEADING_CHILDREN,
  type ToolItem,
} from "./toolbox-config";

interface ToolboxCollapsedRailProps {
  onExpand: () => void;
  onAdd: (type: string, payload: Record<string, unknown>) => void;
}

export function ToolboxCollapsedRail({ onExpand, onAdd }: ToolboxCollapsedRailProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const [activeSubIndex, setActiveSubIndex] = useState<number | null>(null);
  const flyoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic Liquid Glass Scrubbing Tooltip Engine
  const [tooltipItem, setTooltipItem] = useState<ToolItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const isTooltipActiveRef = useRef(false);
  const tooltipTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- COLLAPSED MODE: HEADINGS FLYOUT ---
  const handleHeadingsEnter = (e: React.MouseEvent<HTMLElement>) => {
    if (flyoutTimerRef.current) clearTimeout(flyoutTimerRef.current);
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);

    setTooltipItem(null);
    setTooltipPos(null);

    const rect = e.currentTarget.getBoundingClientRect();
    setFlyoutPos({ top: rect.top - 8, left: rect.right + 12 });
    setFlyoutOpen(true);
  };

  const handleHeadingsLeave = () => {
    flyoutTimerRef.current = setTimeout(() => {
      setFlyoutOpen(false);
      setFlyoutPos(null);
      setActiveSubIndex(null);
    }, 180);
  };

  const handleFlyoutContainerEnter = () => {
    if (flyoutTimerRef.current) clearTimeout(flyoutTimerRef.current);
  };

  const handleFlyoutContainerLeave = () => {
    flyoutTimerRef.current = setTimeout(() => {
      setFlyoutOpen(false);
      setFlyoutPos(null);
      setActiveSubIndex(null);
    }, 180);
  };

  // --- SCRUBBING TOOLTIP HANDLERS ---
  const handleIconMouseEnter = (e: React.MouseEvent<HTMLElement>, item: ToolItem) => {
    if (item.id === "headings") {
      handleHeadingsEnter(e);
      return;
    }

    if (flyoutTimerRef.current) clearTimeout(flyoutTimerRef.current);
    if (flyoutOpen) {
      setFlyoutOpen(false);
      setFlyoutPos(null);
    }

    if (tooltipHideTimerRef.current) clearTimeout(tooltipHideTimerRef.current);
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);

    const rect = e.currentTarget.getBoundingClientRect();
    const targetPos = { top: rect.top + rect.height / 2 - 14, left: rect.right + 12 };

    if (isTooltipActiveRef.current) {
      // Instant scrubbing movement across icons
      setTooltipPos(targetPos);
      setTooltipItem(item);
    } else {
      // Small 70ms debounce for initial hover
      tooltipTimerRef.current = setTimeout(() => {
        setTooltipPos(targetPos);
        setTooltipItem(item);
        isTooltipActiveRef.current = true;
      }, 70);
    }
  };

  const handleIconMouseLeave = (item: ToolItem) => {
    if (item.id === "headings") {
      handleHeadingsLeave();
    }

    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);

    tooltipHideTimerRef.current = setTimeout(() => {
      setTooltipItem(null);
      setTooltipPos(null);
      isTooltipActiveRef.current = false;
    }, 120);
  };

  return (
    <>
      <div className="flex flex-col items-center py-2 px-1 select-none">
        {/* Expand Action Button */}
        <button
          type="button"
          onClick={onExpand}
          aria-label="Expand Toolbox"
          title="Expand toolbox"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all cursor-pointer mb-2 active:scale-95"
        >
          <ChevronRight className="size-4" />
        </button>

        <div className="w-5 h-px bg-border/60 dark:bg-white/10 mb-2" />

        {/* Grouped Icons by Category */}
        <div className="flex flex-col gap-1 items-center">
          {CATEGORIES.map((cat, catIdx) => (
            <React.Fragment key={cat.id}>
              {catIdx > 0 && (
                <div className="w-4 h-px bg-border/40 dark:bg-white/10 my-0.5" />
              )}

              {cat.items.map((item: ToolItem) => {
                const IconComp = item.icon;
                const isHeadings = item.id === "headings";
                const isFlyoutActive = isHeadings && flyoutOpen;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (!isHeadings) {
                        onAdd(item.type, item.payload);
                      } else {
                        setFlyoutOpen((prev) => !prev);
                      }
                    }}
                    onMouseEnter={(e) => handleIconMouseEnter(e, item)}
                    onMouseLeave={() => handleIconMouseLeave(item)}
                    aria-label={item.label}
                    className={`p-2 rounded-xl transition-all cursor-pointer active:scale-95 ${
                      isFlyoutActive
                        ? "bg-blue-500 text-white shadow-xs scale-105"
                        : `${item.categoryAccent.bg} ${item.categoryAccent.color} hover:brightness-110 hover:scale-105`
                    }`}
                  >
                    <IconComp className="size-3.5" />
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* DYNAMIC SCRUBBING LIQUID GLASS TOOLTIP (PORTALED OUTSIDE OVERFLOW-HIDDEN) */}
      {mounted && !flyoutOpen && tooltipItem && tooltipPos && createPortal(
        <div
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
          className={`fixed z-[9999] px-3 py-1.5 rounded-full bg-background/95 dark:bg-zinc-900/95 backdrop-blur-2xl border ${tooltipItem.categoryAccent.tooltipBorder} shadow-[0_8px_25px_-4px_rgba(0,0,0,0.2)] flex items-center gap-2 select-none pointer-events-none transition-all duration-100 ease-out animate-in fade-in-0 zoom-in-95`}
        >
          {/* Simple solid semantic dot (NO pulsing) */}
          <div className={`size-2 rounded-full shrink-0 ${tooltipItem.categoryAccent.dotClass}`} />
          <span className="text-xs font-semibold text-foreground whitespace-nowrap">
            {tooltipItem.label}
          </span>
        </div>,
        document.body
      )}

      {/* Floating Headings Sub-Menu Flyout (PORTALED OUTSIDE OVERFLOW-HIDDEN) */}
      {mounted && flyoutOpen && flyoutPos && createPortal(
        <div
          style={{ top: flyoutPos.top, left: flyoutPos.left }}
          onMouseEnter={handleFlyoutContainerEnter}
          onMouseLeave={handleFlyoutContainerLeave}
          className="fixed z-[9999] p-2.5 rounded-2xl w-[210px] bg-gradient-to-b from-white/95 via-white/85 to-white/75 dark:from-zinc-900/95 dark:via-zinc-900/90 dark:to-zinc-950/85 backdrop-blur-2xl backdrop-saturate-180 border border-white/80 dark:border-white/15 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.18),_inset_0_1px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7),_inset_0_1px_1px_rgba(255,255,255,0.18)] select-none animate-in fade-in-0 zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center gap-1.5 px-2 py-1 mb-1 border-b border-border/40 text-[11px] font-bold tracking-tight text-foreground/90">
            <div className="p-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Heading className="size-3.5" />
            </div>
            <span>Headings</span>
          </div>

          {/* Mini Branched Tree for H1, H2, H3 */}
          <div className="relative flex flex-col">
            <svg
              className="absolute top-0 left-0 overflow-visible pointer-events-none"
              width="28"
              height="132"
              aria-hidden="true"
            >
              {/* Trunk line */}
              <path
                className="stroke-border dark:stroke-white/15"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
                d="M 12 4 V 102"
              />
              {/* Base curves */}
              {HEADING_CHILDREN.map((_, idx) => {
                const cY = idx * 42 + 21;
                return (
                  <path
                    key={idx}
                    className="stroke-border dark:stroke-white/15"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    fill="none"
                    d={`M 12 ${cY - 8} A 8 8 0 0 0 20 ${cY} H 26`}
                  />
                );
              })}
              {/* Active illuminated branch */}
              {activeSubIndex !== null && (
                <path
                  className="stroke-blue-500 dark:stroke-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                  d={`M 12 4 V ${activeSubIndex * 42 + 13} A 8 8 0 0 0 20 ${
                    activeSubIndex * 42 + 21
                  } H 26`}
                />
              )}
            </svg>

            {/* Sub-heading buttons */}
            {HEADING_CHILDREN.map((sub, idx) => {
              const SubIcon = sub.icon;
              const isActive = activeSubIndex === idx;

              return (
                <button
                  key={sub.level}
                  type="button"
                  onClick={() => {
                    onAdd("heading", { text: "", level: sub.level });
                    setFlyoutOpen(false);
                  }}
                  onMouseEnter={() => setActiveSubIndex(idx)}
                  onMouseLeave={() => setActiveSubIndex(null)}
                  style={{ height: 42, paddingLeft: 28 }}
                  className={`group flex items-center gap-2 pr-2 rounded-xl text-left transition-all cursor-pointer ${
                    isActive
                      ? "bg-blue-500/10 dark:bg-blue-500/15"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div
                    className={`p-1 rounded-md transition-all shrink-0 ${
                      isActive
                        ? "bg-blue-500 text-white shadow-xs scale-105"
                        : "bg-muted text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    <SubIcon className="size-3" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span
                      className={`text-xs font-semibold tracking-tight transition-colors ${
                        isActive
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-foreground"
                      }`}
                    >
                      {sub.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-none">
                      {sub.sublabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
