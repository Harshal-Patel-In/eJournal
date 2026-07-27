"use client";

import { useRef, useState } from "react";
import {
  Heading,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  Table as TableIcon,
  Image as ImageIcon,
  Code as CodeIcon,
  CheckSquare,
  BookOpen,
  Split,
  FileDown,
  FileSymlink,
  Sigma,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";
import { useDocumentStore } from "./use-document-store";

export default function FloatingToolbox() {
  const [collapsed, setCollapsed] = useState(false);
  
  // Heading Flyout Popover State
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Responsive Liquid Glass Tooltip Browsing Mode
  const [tooltipText, setTooltipText] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const isTooltipActiveRef = useRef(false);
  const tooltipTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { blocks, addBlock, previewMode } = useDocumentStore();

  if (previewMode) return null;

  const handleAdd = (type: string, content: any) => {
    addBlock(blocks.length, type, content);
    setPopoverOpen(false);
    handleIconMouseLeave();
  };

  // --- HEADING POPOVER HANDLERS ---
  const handleHeadingMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    handleIconMouseLeave(); // Clear tooltip if any
    if (popoverLeaveTimeoutRef.current) clearTimeout(popoverLeaveTimeoutRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setPopoverPos({ top: rect.top, left: rect.right + 6 });
    setPopoverOpen(true);
  };

  const handleHeadingMouseLeave = () => {
    popoverLeaveTimeoutRef.current = setTimeout(() => {
      setPopoverOpen(false);
    }, 180);
  };

  const handlePopoverMouseEnter = () => {
    if (popoverLeaveTimeoutRef.current) clearTimeout(popoverLeaveTimeoutRef.current);
  };

  const handlePopoverMouseLeave = () => {
    setPopoverOpen(false);
  };

  // --- RESPONSIVE TOOLTIP SCRUBBING HANDLERS ---
  const handleIconMouseEnter = (e: React.MouseEvent<HTMLElement>, label: string) => {
    if (!collapsed) return; // Only in collapsed mode

    if (tooltipHideTimerRef.current) clearTimeout(tooltipHideTimerRef.current);
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);

    const rect = e.currentTarget.getBoundingClientRect();
    const targetPos = { top: rect.top + rect.height / 2 - 14, left: rect.right + 8 };

    if (isTooltipActiveRef.current) {
      // User is actively scrubbing across icons -> Update INSTANTLY with fluid CSS sliding transition!
      setTooltipPos(targetPos);
      setTooltipText(label);
    } else {
      // First hover from outside -> Brief 100ms responsive entry threshold
      tooltipTimerRef.current = setTimeout(() => {
        setTooltipPos(targetPos);
        setTooltipText(label);
        isTooltipActiveRef.current = true;
      }, 100);
    }
  };

  const handleIconMouseLeave = () => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);

    // Grace period (150ms) to allow smooth sliding to neighboring icon without dismissing
    tooltipHideTimerRef.current = setTimeout(() => {
      setTooltipText(null);
      setTooltipPos(null);
      isTooltipActiveRef.current = false;
    }, 150);
  };

  return (
    <>
      <aside
        className={`fixed left-4 top-24 z-40 transition-all duration-300 select-none ${
          collapsed ? "w-11" : "w-[165px]"
        }`}
      >
        <div className="relative flex flex-col bg-gradient-to-b from-white/70 via-white/50 to-white/30 dark:from-white/15 dark:via-white/10 dark:to-white/5 backdrop-blur-2xl backdrop-saturate-180 border border-white/60 dark:border-white/20 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.2)] rounded-2xl overflow-hidden transition-all duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/50 bg-muted/30">
            {!collapsed && (
              <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground tracking-tight">
                <div className="p-1 rounded-md bg-primary/10 text-primary">
                  <Layers className="size-3.5" />
                </div>
                <span>Toolbox</span>
              </div>
            )}
            <button
              onClick={() => {
                handleIconMouseLeave();
                setCollapsed(!collapsed);
              }}
              title={collapsed ? "Expand Toolbox" : "Collapse to Bar"}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer mx-auto"
            >
              {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
            </button>
          </div>

          {/* Compact Tool Groups */}
          <div className="p-1 flex flex-col gap-1.5 max-h-[calc(100vh-140px)] overflow-y-auto overflow-x-hidden custom-scrollbar">

            {/* 1. STRUCTURE */}
            <div className="flex flex-col gap-0.5">
              {!collapsed && (
                <span className="px-2 pt-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  Structure
                </span>
              )}

              {/* HEADINGS ITEM WITH VIEWPORT-FIXED POPOVER */}
              <button
                onMouseEnter={handleHeadingMouseEnter}
                onMouseLeave={handleHeadingMouseLeave}
                className={`group flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-all cursor-pointer hover:bg-primary/10 border border-transparent hover:border-primary/20 ${
                  collapsed ? "justify-center" : ""
                }`}
              >
                <div className="p-1 rounded-md bg-muted group-hover:bg-primary group-hover:text-primary-foreground text-foreground transition-all shrink-0">
                  <Heading className="size-3.5" />
                </div>
                {!collapsed && (
                  <div className="flex items-center justify-between w-full min-w-0">
                    <span className="text-xs font-semibold text-foreground group-hover:text-primary truncate">
                      Headings
                    </span>
                    <ChevronRight className="size-3 text-muted-foreground/60 group-hover:text-primary transition-transform group-hover:translate-x-0.5" />
                  </div>
                )}
              </button>

              {/* PARAGRAPH */}
              <button
                onClick={() => handleAdd("paragraph", { text: "" })}
                onMouseEnter={(e) => handleIconMouseEnter(e, "Paragraph")}
                onMouseLeave={handleIconMouseLeave}
                className={`group flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-all hover:bg-primary/10 border border-transparent hover:border-primary/20 cursor-pointer ${
                  collapsed ? "justify-center" : ""
                }`}
              >
                <div className="p-1 rounded-md bg-muted group-hover:bg-primary group-hover:text-primary-foreground text-foreground transition-all shrink-0">
                  <AlignLeft className="size-3.5" />
                </div>
                {!collapsed && (
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary truncate">
                    Paragraph
                  </span>
                )}
              </button>
            </div>

            {/* 2. MATH & DATA */}
            <div className="flex flex-col gap-0.5">
              {!collapsed && (
                <span className="px-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  Math & Data
                </span>
              )}

              <button
                onClick={() => handleAdd("equation", { latex: "" })}
                onMouseEnter={(e) => handleIconMouseEnter(e, "Math Equation")}
                onMouseLeave={handleIconMouseLeave}
                className={`group flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-all hover:bg-primary/10 border border-transparent hover:border-primary/20 cursor-pointer ${
                  collapsed ? "justify-center" : ""
                }`}
              >
                <div className="p-1 rounded-md bg-muted group-hover:bg-primary group-hover:text-primary-foreground text-foreground transition-all shrink-0">
                  <Sigma className="size-3.5" />
                </div>
                {!collapsed && (
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary truncate">
                    Math Equation
                  </span>
                )}
              </button>

              <button
                onClick={() =>
                  handleAdd("table", {
                    headers: ["Speed (km/h)", "Distance (m)", "Time (s)"],
                    rows: [["", "", ""]],
                  })
                }
                onMouseEnter={(e) => handleIconMouseEnter(e, "Data Table")}
                onMouseLeave={handleIconMouseLeave}
                className={`group flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-all hover:bg-primary/10 border border-transparent hover:border-primary/20 cursor-pointer ${
                  collapsed ? "justify-center" : ""
                }`}
              >
                <div className="p-1 rounded-md bg-muted group-hover:bg-primary group-hover:text-primary-foreground text-foreground transition-all shrink-0">
                  <TableIcon className="size-3.5" />
                </div>
                {!collapsed && (
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary truncate">
                    Data Table
                  </span>
                )}
              </button>
            </div>

            {/* 3. MEDIA & CODE */}
            <div className="flex flex-col gap-0.5">
              {!collapsed && (
                <span className="px-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  Media & Code
                </span>
              )}

              <button
                onClick={() => handleAdd("image", { url: "", caption: "" })}
                onMouseEnter={(e) => handleIconMouseEnter(e, "Figure / Image")}
                onMouseLeave={handleIconMouseLeave}
                className={`group flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-all hover:bg-primary/10 border border-transparent hover:border-primary/20 cursor-pointer ${
                  collapsed ? "justify-center" : ""
                }`}
              >
                <div className="p-1 rounded-md bg-muted group-hover:bg-primary group-hover:text-primary-foreground text-foreground transition-all shrink-0">
                  <ImageIcon className="size-3.5" />
                </div>
                {!collapsed && (
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary truncate">
                    Figure / Image
                  </span>
                )}
              </button>

              <button
                onClick={() => handleAdd("code", { text: "", language: "python" })}
                onMouseEnter={(e) => handleIconMouseEnter(e, "Code Snippet")}
                onMouseLeave={handleIconMouseLeave}
                className={`group flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-all hover:bg-primary/10 border border-transparent hover:border-primary/20 cursor-pointer ${
                  collapsed ? "justify-center" : ""
                }`}
              >
                <div className="p-1 rounded-md bg-muted group-hover:bg-primary group-hover:text-primary-foreground text-foreground transition-all shrink-0">
                  <CodeIcon className="size-3.5" />
                </div>
                {!collapsed && (
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary truncate">
                    Code Snippet
                  </span>
                )}
              </button>
            </div>

            {/* 4. ACADEMIC ANALYSIS */}
            <div className="flex flex-col gap-0.5">
              {!collapsed && (
                <span className="px-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  Analysis
                </span>
              )}

              <button
                onClick={() => handleAdd("observation", { text: "" })}
                onMouseEnter={(e) => handleIconMouseEnter(e, "Observation")}
                onMouseLeave={handleIconMouseLeave}
                className={`group flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-all hover:bg-primary/10 border border-transparent hover:border-primary/20 cursor-pointer ${
                  collapsed ? "justify-center" : ""
                }`}
              >
                <div className="p-1 rounded-md bg-muted group-hover:bg-primary group-hover:text-primary-foreground text-foreground transition-all shrink-0">
                  <FileSymlink className="size-3.5" />
                </div>
                {!collapsed && (
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary truncate">
                    Observation
                  </span>
                )}
              </button>

              <button
                onClick={() => handleAdd("result", { text: "" })}
                onMouseEnter={(e) => handleIconMouseEnter(e, "Result Statement")}
                onMouseLeave={handleIconMouseLeave}
                className={`group flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-all hover:bg-primary/10 border border-transparent hover:border-primary/20 cursor-pointer ${
                  collapsed ? "justify-center" : ""
                }`}
              >
                <div className="p-1 rounded-md bg-muted group-hover:bg-primary group-hover:text-primary-foreground text-foreground transition-all shrink-0">
                  <CheckSquare className="size-3.5" />
                </div>
                {!collapsed && (
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary truncate">
                    Result Statement
                  </span>
                )}
              </button>

              <button
                onClick={() => handleAdd("reference", { text: "" })}
                onMouseEnter={(e) => handleIconMouseEnter(e, "Reference Citation")}
                onMouseLeave={handleIconMouseLeave}
                className={`group flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-all hover:bg-primary/10 border border-transparent hover:border-primary/20 cursor-pointer ${
                  collapsed ? "justify-center" : ""
                }`}
              >
                <div className="p-1 rounded-md bg-muted group-hover:bg-primary group-hover:text-primary-foreground text-foreground transition-all shrink-0">
                  <BookOpen className="size-3.5" />
                </div>
                {!collapsed && (
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary truncate">
                    Reference
                  </span>
                )}
              </button>
            </div>

            {/* 5. LAYOUT */}
            <div className="flex flex-col gap-0.5">
              {!collapsed && (
                <span className="px-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  Layout
                </span>
              )}

              <button
                onClick={() => handleAdd("divider", {})}
                onMouseEnter={(e) => handleIconMouseEnter(e, "Section Divider")}
                onMouseLeave={handleIconMouseLeave}
                className={`group flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-all hover:bg-primary/10 border border-transparent hover:border-primary/20 cursor-pointer ${
                  collapsed ? "justify-center" : ""
                }`}
              >
                <div className="p-1 rounded-md bg-muted group-hover:bg-primary group-hover:text-primary-foreground text-foreground transition-all shrink-0">
                  <Split className="size-3.5" />
                </div>
                {!collapsed && (
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary truncate">
                    Divider
                  </span>
                )}
              </button>

              <button
                onClick={() => handleAdd("page_break", {})}
                onMouseEnter={(e) => handleIconMouseEnter(e, "Page Break")}
                onMouseLeave={handleIconMouseLeave}
                className={`group flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-all hover:bg-primary/10 border border-transparent hover:border-primary/20 cursor-pointer ${
                  collapsed ? "justify-center" : ""
                }`}
              >
                <div className="p-1 rounded-md bg-muted group-hover:bg-primary group-hover:text-primary-foreground text-foreground transition-all shrink-0">
                  <FileDown className="size-3.5" />
                </div>
                {!collapsed && (
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary truncate">
                    Page Break
                  </span>
                )}
              </button>
            </div>

          </div>
        </div>
      </aside>

      {/* VIEWPORT-FIXED LIQUID GLASS HEADING SELECTOR POPOVER */}
      {popoverOpen && popoverPos && (
        <div
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
          style={{ top: popoverPos.top, left: popoverPos.left }}
          className="fixed z-50 w-48 p-1.5 rounded-2xl bg-card/90 backdrop-blur-2xl border border-border/80 shadow-2xl flex flex-col gap-1 select-none transition-all duration-150 animate-in fade-in-0 zoom-in-95"
        >
          <div className="px-2.5 py-1 border-b border-border/40 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Select Heading Level
            </span>
          </div>

          <button
            onClick={() => handleAdd("heading", { text: "", level: 1 })}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-primary/10 text-left transition-all cursor-pointer group border border-transparent hover:border-primary/20"
          >
            <div className="p-1 rounded-md bg-muted group-hover:bg-primary group-hover:text-primary-foreground text-foreground transition-colors shrink-0">
              <Heading1 className="size-3.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                Heading 1
              </span>
              <span className="text-[10px] text-muted-foreground">Main Section Title</span>
            </div>
          </button>

          <button
            onClick={() => handleAdd("heading", { text: "", level: 2 })}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-primary/10 text-left transition-all cursor-pointer group border border-transparent hover:border-primary/20"
          >
            <div className="p-1 rounded-md bg-muted group-hover:bg-primary group-hover:text-primary-foreground text-foreground transition-colors shrink-0">
              <Heading2 className="size-3.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                Heading 2
              </span>
              <span className="text-[10px] text-muted-foreground">Subsection Title</span>
            </div>
          </button>

          <button
            onClick={() => handleAdd("heading", { text: "", level: 3 })}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-primary/10 text-left transition-all cursor-pointer group border border-transparent hover:border-primary/20"
          >
            <div className="p-1 rounded-md bg-muted group-hover:bg-primary group-hover:text-primary-foreground text-foreground transition-colors shrink-0">
              <Heading3 className="size-3.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                Heading 3
              </span>
              <span className="text-[10px] text-muted-foreground">Minor Sub-item Title</span>
            </div>
          </button>
        </div>
      )}

      {/* RESPONSIVE LIQUID GLASS TOOLTIP WITH FLUID SLIDING TRANSITION */}
      {collapsed && tooltipText && tooltipPos && (
        <div
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
          className="fixed z-50 px-2.5 py-1 rounded-xl bg-card/95 backdrop-blur-2xl border border-border/80 shadow-2xl text-xs font-semibold text-foreground flex items-center gap-1.5 select-none transition-all duration-150 ease-out pointer-events-none animate-in fade-in-0 zoom-in-95"
        >
          <div className="size-1.5 rounded-full bg-primary animate-pulse" />
          <span>{tooltipText}</span>
        </div>
      )}
    </>
  );
}
