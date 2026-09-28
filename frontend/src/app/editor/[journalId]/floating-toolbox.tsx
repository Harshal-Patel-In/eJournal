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
  LineChart,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";
import { useDocumentStore } from "./use-document-store";

// ==========================================
// TOOLBOX CONFIGURATION & DATA STRUCTURE
// ==========================================

export interface HeadingSubOption {
  level: 1 | 2 | 3;
  label: string;
  sublabel: string;
  icon: any;
}

export interface ToolItem {
  id: string;
  type: string;
  label: string;
  icon: any;
  payload: any;
  hasChildren?: boolean;
  children?: HeadingSubOption[];
}

export interface CategoryGroup {
  id: string;
  label: string;
  items: ToolItem[];
}

const HEADING_CHILDREN: HeadingSubOption[] = [
  { level: 1, label: "Heading 1", sublabel: "Section Aim / Title", icon: Heading1 },
  { level: 2, label: "Heading 2", sublabel: "Method / Subsection", icon: Heading2 },
  { level: 3, label: "Heading 3", sublabel: "Minor Sub-item", icon: Heading3 },
];

const CATEGORIES: CategoryGroup[] = [
  {
    id: "structure",
    label: "Structure",
    items: [
      {
        id: "headings",
        type: "heading",
        label: "Headings",
        icon: Heading,
        payload: {},
        hasChildren: true,
        children: HEADING_CHILDREN,
      },
      {
        id: "paragraph",
        type: "paragraph",
        label: "Paragraph",
        icon: AlignLeft,
        payload: { text: "" },
      },
    ],
  },
  {
    id: "math_data",
    label: "Math & Data",
    items: [
      {
        id: "equation",
        type: "equation",
        label: "Math Equation",
        icon: Sigma,
        payload: { latex: "" },
      },
      {
        id: "table",
        type: "table",
        label: "Data Table",
        icon: TableIcon,
        payload: {
          headers: ["Speed (km/h)", "Distance (m)", "Time (s)"],
          rows: [["", "", ""]],
        },
      },
      {
        id: "graph",
        type: "graph",
        label: "Graph Plot",
        icon: LineChart,
        payload: {
          title: "Experimental Graph Plot",
          chartType: "scatter",
          showTrendline: true,
          showGrid: true,
        },
      },
    ],
  },
  {
    id: "media_code",
    label: "Media & Code",
    items: [
      {
        id: "image",
        type: "image",
        label: "Figure / Image",
        icon: ImageIcon,
        payload: { url: "", caption: "" },
      },
      {
        id: "code",
        type: "code",
        label: "Code Snippet",
        icon: CodeIcon,
        payload: { text: "", language: "python" },
      },
    ],
  },
  {
    id: "analysis",
    label: "Analysis",
    items: [
      {
        id: "observation",
        type: "observation",
        label: "Observation",
        icon: FileSymlink,
        payload: { text: "" },
      },
      {
        id: "result",
        type: "result",
        label: "Result Statement",
        icon: CheckSquare,
        payload: { text: "" },
      },
      {
        id: "reference",
        type: "reference",
        label: "Reference",
        icon: BookOpen,
        payload: { text: "" },
      },
    ],
  },
  {
    id: "layout",
    label: "Layout",
    items: [
      {
        id: "divider",
        type: "divider",
        label: "Divider",
        icon: Split,
        payload: {},
      },
      {
        id: "page_break",
        type: "page_break",
        label: "Page Break",
        icon: FileDown,
        payload: {},
      },
    ],
  },
];

// ==========================================
// MATHEMATICAL SVG TREE GEOMETRY (REACT BITS SPEC)
// ==========================================

const ROW_H = 32;
const TRUNK_X = 18;
const CURVE_R = 9;
const END_X = 28;

// Sub-tree for Headings (H1, H2, H3 in Expanded View)
const SUB_ROW_H = 28;
const SUB_TRUNK_X = 26;
const SUB_CURVE_R = 7;
const SUB_END_X = 36;
const TOTAL_SUB_H = HEADING_CHILDREN.length * SUB_ROW_H;

// Dynamic Y calculation ensuring zero misalignment when Headings expands/collapses
const getItemY = (catId: string, itemIdx: number, isHeadingsOpen: boolean) => {
  if (catId === "structure" && itemIdx > 0 && isHeadingsOpen) {
    return itemIdx * ROW_H + TOTAL_SUB_H;
  }
  return itemIdx * ROW_H;
};

const getItemCenterY = (catId: string, itemIdx: number, isHeadingsOpen: boolean) => {
  return getItemY(catId, itemIdx, isHeadingsOpen) + ROW_H / 2;
};

const getCategoryTotalH = (cat: CategoryGroup, isHeadingsOpen: boolean) => {
  return cat.items.length * ROW_H + (cat.id === "structure" && isHeadingsOpen ? TOTAL_SUB_H : 0);
};

export default function FloatingToolbox() {
  const [collapsed, setCollapsed] = useState(false);

  // Expanded Mode: Headings Hover Unfold State
  const [headingsOpen, setHeadingsOpen] = useState(false);
  const [activeSubBranch, setActiveSubBranch] = useState<number | null>(null);
  const headingsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Collapsed Mode: Floating Headings Sub-menu Flyout State
  const [collapsedFlyoutOpen, setCollapsedFlyoutOpen] = useState(false);
  const [collapsedFlyoutPos, setCollapsedFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const collapsedFlyoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [activeFlyoutIndex, setActiveFlyoutIndex] = useState<number | null>(null);

  // Hovered item ID across all categories (for branch illumination)
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  // Responsive Liquid Glass Tooltip Browsing Mode (Collapsed Rail)
  const [tooltipText, setTooltipText] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const isTooltipActiveRef = useRef(false);
  const tooltipTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { blocks, addBlock, previewMode } = useDocumentStore();

  if (previewMode) return null;

  const handleAdd = (type: string, content: any) => {
    addBlock(blocks.length, type, content);
    setHeadingsOpen(false);
    setCollapsedFlyoutOpen(false);
    handleIconMouseLeave();
  };

  // --- EXPANDED MODE: HEADINGS HOVER REVEAL HANDLERS ---
  const handleHeadingsMouseEnter = () => {
    if (collapsed) return;
    if (headingsTimeoutRef.current) clearTimeout(headingsTimeoutRef.current);
    setHeadingsOpen(true);
  };

  const handleHeadingsMouseLeave = () => {
    if (collapsed) return;
    headingsTimeoutRef.current = setTimeout(() => {
      setHeadingsOpen(false);
      setActiveSubBranch(null);
    }, 220);
  };

  // --- COLLAPSED MODE: HEADINGS FLOATING FLYOUT HANDLERS ---
  const handleCollapsedHeadingsEnter = (e: React.MouseEvent<HTMLElement>) => {
    if (!collapsed) return;
    if (collapsedFlyoutTimerRef.current) clearTimeout(collapsedFlyoutTimerRef.current);
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    
    // Suppress simple tooltip when hovering Headings in collapsed mode
    setTooltipText(null);
    setTooltipPos(null);

    const rect = e.currentTarget.getBoundingClientRect();
    setCollapsedFlyoutPos({ top: rect.top - 8, left: rect.right + 10 });
    setCollapsedFlyoutOpen(true);
  };

  const handleCollapsedHeadingsLeave = () => {
    if (!collapsed) return;
    collapsedFlyoutTimerRef.current = setTimeout(() => {
      setCollapsedFlyoutOpen(false);
      setCollapsedFlyoutPos(null);
      setActiveFlyoutIndex(null);
    }, 220);
  };

  const handleFlyoutContainerEnter = () => {
    if (collapsedFlyoutTimerRef.current) clearTimeout(collapsedFlyoutTimerRef.current);
  };

  const handleFlyoutContainerLeave = () => {
    collapsedFlyoutTimerRef.current = setTimeout(() => {
      setCollapsedFlyoutOpen(false);
      setCollapsedFlyoutPos(null);
      setActiveFlyoutIndex(null);
    }, 220);
  };

  // --- RESPONSIVE TOOLTIP SCRUBBING HANDLERS (COLLAPSED MODE) ---
  const handleIconMouseEnter = (e: React.MouseEvent<HTMLElement>, label: string, isHeadings = false) => {
    if (!collapsed) return;

    if (isHeadings) {
      handleCollapsedHeadingsEnter(e);
      return;
    }

    if (collapsedFlyoutTimerRef.current) clearTimeout(collapsedFlyoutTimerRef.current);
    if (collapsedFlyoutOpen) {
      setCollapsedFlyoutOpen(false);
      setCollapsedFlyoutPos(null);
    }

    if (tooltipHideTimerRef.current) clearTimeout(tooltipHideTimerRef.current);
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);

    const rect = e.currentTarget.getBoundingClientRect();
    const targetPos = { top: rect.top + rect.height / 2 - 14, left: rect.right + 10 };

    if (isTooltipActiveRef.current) {
      setTooltipPos(targetPos);
      setTooltipText(label);
    } else {
      tooltipTimerRef.current = setTimeout(() => {
        setTooltipPos(targetPos);
        setTooltipText(label);
        isTooltipActiveRef.current = true;
      }, 80);
    }
  };

  const handleIconMouseLeave = (isHeadings = false) => {
    if (isHeadings) {
      handleCollapsedHeadingsLeave();
    }

    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);

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
          collapsed ? "w-11" : "w-[208px]"
        }`}
      >
        <div className="relative flex flex-col bg-gradient-to-b from-white/90 via-white/75 to-white/60 dark:from-zinc-900/90 dark:via-zinc-900/80 dark:to-zinc-950/75 backdrop-blur-2xl backdrop-saturate-180 border border-white/80 dark:border-white/15 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.12),_inset_0_1px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7),_inset_0_1px_1px_rgba(255,255,255,0.18)] rounded-2xl overflow-hidden transition-all duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/50 bg-muted/20">
            {!collapsed && (
              <div className="flex items-center gap-1.5 font-bold text-xs text-foreground tracking-tight">
                <div className="p-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Layers className="size-3.5" />
                </div>
                <span>Toolbox</span>
              </div>
            )}
            <button
              onClick={() => {
                handleIconMouseLeave();
                setCollapsed(!collapsed);
                setHeadingsOpen(false);
                setCollapsedFlyoutOpen(false);
              }}
              aria-label={collapsed ? "Expand Toolbox" : "Collapse to Bar"}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all cursor-pointer mx-auto"
            >
              {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
            </button>
          </div>

          {/* Unified Scroll Container */}
          <div className="relative p-2 flex flex-col gap-2 max-h-[calc(100vh-140px)] overflow-y-auto overflow-x-hidden custom-scrollbar">
            
            {/* Continuous Vertical Left Rail (Expanded Mode) */}
            {!collapsed && (
              <div
                className="absolute top-3 bottom-3 left-[9px] w-px bg-gradient-to-b from-border/70 via-border/50 to-transparent pointer-events-none"
                aria-hidden="true"
              />
            )}

            {/* Iterate Every Category */}
            {CATEGORIES.map((cat, catIdx) => {
              const catTotalH = getCategoryTotalH(cat, headingsOpen);
              const isCategoryActive =
                cat.items.some((item) => item.id === hoveredItemId) ||
                (cat.id === "structure" && (headingsOpen || activeSubBranch !== null || collapsedFlyoutOpen));

              return (
                <div key={cat.id} className="flex flex-col relative">
                  
                  {/* Collapsed Mode: Delicate macOS Dock Category Divider */}
                  {collapsed && catIdx > 0 && (
                    <div className="w-5 h-px bg-border/50 dark:bg-white/10 my-1 mx-auto" aria-hidden="true" />
                  )}

                  {/* Expanded Mode: Category Section Header */}
                  {!collapsed && (
                    <div className="relative pl-5 pr-2 pt-0.5 pb-1 flex items-center justify-between">
                      {/* Active Section Marker Bar on Left Rail */}
                      {isCategoryActive && (
                        <div
                          className="absolute left-[8px] top-1 bottom-1 w-[2.5px] rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-in fade-in-0 duration-200"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={`text-[11px] tracking-tight transition-colors duration-200 ${
                          isCategoryActive
                            ? "font-bold text-blue-600 dark:text-blue-400"
                            : "font-semibold text-muted-foreground/80 dark:text-zinc-400"
                        }`}
                      >
                        {cat.label}
                      </span>
                    </div>
                  )}

                  {/* Collapsed Mode: Clean Icon Strip (No native title attribute!) */}
                  {collapsed ? (
                    <div className="flex flex-col gap-1 items-center py-0.5">
                      {cat.items.map((item) => {
                        const IconComp = item.icon;
                        const isHeadings = item.id === "headings";
                        const isFlyoutActive = isHeadings && collapsedFlyoutOpen;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (isHeadings) {
                                // In collapsed mode, click toggles the floating flyout
                                setCollapsedFlyoutOpen((prev) => !prev);
                              } else {
                                handleAdd(item.type, item.payload);
                              }
                            }}
                            onMouseEnter={(e) => handleIconMouseEnter(e, item.label, isHeadings)}
                            onMouseLeave={() => handleIconMouseLeave(isHeadings)}
                            aria-label={item.label}
                            className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                              isFlyoutActive
                                ? "bg-blue-500 text-white shadow-xs"
                                : "hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 text-muted-foreground"
                            }`}
                          >
                            <IconComp className="size-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    /* Expanded Mode: Integrated SVG Branched Rail for this Category */
                    <div className="relative">
                      {/* Mathematical SVG Branch Lines Rail */}
                      <svg
                        className="absolute top-0 left-0 overflow-visible pointer-events-none transition-all duration-200"
                        width={END_X + 2}
                        height={catTotalH}
                        aria-hidden="true"
                      >
                        {/* Category Trunk - Drops to center of last item */}
                        <path
                          className="stroke-border/70 dark:stroke-white/15"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                          d={`M ${TRUNK_X} 0 V ${
                            getItemCenterY(cat.id, cat.items.length - 1, headingsOpen) - CURVE_R
                          }`}
                        />

                        {/* Base Curved Branch Arcs leading directly into each tool */}
                        {cat.items.map((_, k) => {
                          const cY = getItemCenterY(cat.id, k, headingsOpen);
                          const d = `M ${TRUNK_X} ${cY - CURVE_R} A ${CURVE_R} ${CURVE_R} 0 0 0 ${
                            TRUNK_X + CURVE_R
                          } ${cY} H ${END_X}`;
                          return (
                            <path
                              key={k}
                              className="stroke-border/70 dark:stroke-white/15"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              fill="none"
                              d={d}
                            />
                          );
                        })}

                        {/* Animated Luminous Reach Line when item is hovered */}
                        {cat.items.map((item, k) => {
                          const isHovered = hoveredItemId === item.id;
                          const cY = getItemCenterY(cat.id, k, headingsOpen);
                          const d = `M ${TRUNK_X} 0 V ${cY - CURVE_R} A ${CURVE_R} ${CURVE_R} 0 0 0 ${
                            TRUNK_X + CURVE_R
                          } ${cY} H ${END_X}`;
                          const pathLen =
                            cY - CURVE_R + (Math.PI * CURVE_R) / 2 + (END_X - TRUNK_X - CURVE_R);

                          return (
                            <path
                              key={item.id}
                              className="stroke-blue-500 dark:stroke-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              fill="none"
                              d={d}
                              style={{
                                strokeDasharray: pathLen,
                                strokeDashoffset: isHovered ? 0 : pathLen,
                                transition: "stroke-dashoffset 240ms cubic-bezier(0.23, 1, 0.32, 1)",
                              }}
                            />
                          );
                        })}
                      </svg>

                      {/* Items Column in this Category */}
                      <div className="flex flex-col">
                        {cat.items.map((item) => {
                          const IconComponent = item.icon;
                          const isHovered = hoveredItemId === item.id;

                          // HEADINGS ITEM: Special Hover-Reveal Branch Container
                          if (item.hasChildren && item.children) {
                            return (
                              <div
                                key={item.id}
                                className="flex flex-col"
                                onMouseEnter={handleHeadingsMouseEnter}
                                onMouseLeave={handleHeadingsMouseLeave}
                              >
                                <button
                                  type="button"
                                  onClick={() => setHeadingsOpen((prev) => !prev)}
                                  onMouseEnter={() => setHoveredItemId(item.id)}
                                  onMouseLeave={() => setHoveredItemId(null)}
                                  style={{ height: ROW_H, paddingLeft: END_X + 2 }}
                                  className={`group flex items-center justify-between w-full pr-2 text-left transition-all cursor-pointer rounded-xl ${
                                    isHovered || headingsOpen
                                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                      : "hover:bg-primary/5 text-muted-foreground/80 hover:text-foreground"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <IconComponent
                                      className={`size-3.5 transition-transform shrink-0 ${
                                        isHovered || headingsOpen
                                          ? "text-blue-600 dark:text-blue-400 scale-105"
                                          : "text-muted-foreground group-hover:text-foreground"
                                      }`}
                                    />
                                    <span
                                      className={`text-xs tracking-tight truncate transition-colors ${
                                        isHovered || headingsOpen ? "font-bold text-foreground" : "font-medium"
                                      }`}
                                    >
                                      {item.label}
                                    </span>
                                  </div>

                                  <ChevronRight
                                    className={`size-3 transition-transform duration-200 shrink-0 ${
                                      headingsOpen
                                        ? "rotate-90 text-blue-600 dark:text-blue-400"
                                        : "rotate-0 text-muted-foreground/50"
                                    }`}
                                  />
                                </button>

                                {/* Smooth CSS Grid Folding Container for H1, H2, H3 */}
                                <div
                                  style={{ gridTemplateRows: headingsOpen ? "1fr" : "0fr" }}
                                  className="grid transition-[grid-template-rows] duration-250 ease-out"
                                >
                                  <div className="overflow-hidden min-h-0">
                                    <div className="relative pt-0.5 pb-0.5" style={{ height: TOTAL_SUB_H }}>
                                      {/* Sub-tree SVG Branch Rail */}
                                      <svg
                                        className="absolute top-0 left-0 overflow-visible pointer-events-none"
                                        width={SUB_END_X + 2}
                                        height={TOTAL_SUB_H}
                                        aria-hidden="true"
                                      >
                                        {/* Feeder line continuing category trunk down past the sub-tree */}
                                        <path
                                          className="stroke-border/70 dark:stroke-white/15"
                                          strokeWidth="1.5"
                                          strokeLinecap="round"
                                          fill="none"
                                          d={`M ${TRUNK_X} 0 V ${TOTAL_SUB_H}`}
                                        />

                                        {/* Sub-trunk for H1, H2, H3 */}
                                        <path
                                          className="stroke-border/70 dark:stroke-white/15"
                                          strokeWidth="1.5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          fill="none"
                                          d={`M ${SUB_TRUNK_X} 0 V ${
                                            (item.children.length - 1) * SUB_ROW_H + SUB_ROW_H / 2 - SUB_CURVE_R
                                          }`}
                                        />

                                        {/* Sub-branch Arcs */}
                                        {item.children.map((_, j) => {
                                          const subY = j * SUB_ROW_H + SUB_ROW_H / 2;
                                          const d = `M ${SUB_TRUNK_X} ${
                                            subY - SUB_CURVE_R
                                          } A ${SUB_CURVE_R} ${SUB_CURVE_R} 0 0 0 ${
                                            SUB_TRUNK_X + SUB_CURVE_R
                                          } ${subY} H ${SUB_END_X}`;
                                          return (
                                            <path
                                              key={j}
                                              className="stroke-border/70 dark:stroke-white/15"
                                              strokeWidth="1.5"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              fill="none"
                                              d={d}
                                            />
                                          );
                                        })}

                                        {/* Animated Neon Reach Line to hovered Heading */}
                                        {item.children.map((sub, j) => {
                                          const isSubActive = activeSubBranch === j;
                                          const subY = j * SUB_ROW_H + SUB_ROW_H / 2;
                                          const d = `M ${SUB_TRUNK_X} 0 V ${
                                            subY - SUB_CURVE_R
                                          } A ${SUB_CURVE_R} ${SUB_CURVE_R} 0 0 0 ${
                                            SUB_TRUNK_X + SUB_CURVE_R
                                          } ${subY} H ${SUB_END_X}`;
                                          const subLen =
                                            subY -
                                            SUB_CURVE_R +
                                            (Math.PI * SUB_CURVE_R) / 2 +
                                            (SUB_END_X - SUB_TRUNK_X - SUB_CURVE_R);

                                          return (
                                            <path
                                              key={sub.level}
                                              className="stroke-blue-500 dark:stroke-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]"
                                              strokeWidth="2"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              fill="none"
                                              d={d}
                                              style={{
                                                strokeDasharray: subLen,
                                                strokeDashoffset: isSubActive ? 0 : subLen,
                                                transition:
                                                  "stroke-dashoffset 240ms cubic-bezier(0.23, 1, 0.32, 1)",
                                              }}
                                            />
                                          );
                                        })}
                                      </svg>

                                      {/* Heading Sub-options (H1, H2, H3) */}
                                      <div className="flex flex-col">
                                        {item.children.map((sub, j) => {
                                          const SubIcon = sub.icon;
                                          const isSubActive = activeSubBranch === j;
                                          return (
                                            <button
                                              key={sub.level}
                                              type="button"
                                              onClick={() =>
                                                handleAdd("heading", { text: "", level: sub.level })
                                              }
                                              onMouseEnter={() => setActiveSubBranch(j)}
                                              onMouseLeave={() => setActiveSubBranch(null)}
                                              style={{ height: SUB_ROW_H, paddingLeft: SUB_END_X + 2 }}
                                              className="group/sub flex items-center gap-2 w-full pr-2 text-left transition-colors cursor-pointer rounded-lg hover:bg-blue-500/10 dark:hover:bg-blue-500/15"
                                            >
                                              <SubIcon
                                                className={`size-3 transition-colors shrink-0 ${
                                                  isSubActive
                                                    ? "text-blue-600 dark:text-blue-400 scale-105"
                                                    : "text-muted-foreground group-hover/sub:text-blue-600 dark:group-hover/sub:text-blue-400"
                                                }`}
                                              />
                                              <div className="flex flex-col min-w-0">
                                                <span
                                                  className={`text-[11px] tracking-tight truncate leading-tight transition-colors ${
                                                    isSubActive
                                                      ? "font-bold text-blue-600 dark:text-blue-400"
                                                      : "font-semibold text-foreground group-hover/sub:text-blue-600 dark:group-hover/sub:text-blue-400"
                                                  }`}
                                                >
                                                  {sub.label}
                                                </span>
                                                <span className="text-[9px] text-muted-foreground truncate leading-none">
                                                  {sub.sublabel}
                                                </span>
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          // STANDARD DIRECT 1-CLICK TOOLS (Paragraph, Equation, Table, Graph, Image, Code, etc.)
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleAdd(item.type, item.payload)}
                              onMouseEnter={() => setHoveredItemId(item.id)}
                              onMouseLeave={() => setHoveredItemId(null)}
                              style={{ height: ROW_H, paddingLeft: END_X + 2 }}
                              className={`group flex items-center gap-2 w-full pr-2 text-left transition-all cursor-pointer rounded-xl ${
                                isHovered
                                  ? "bg-blue-500/10 dark:bg-blue-500/15"
                                  : "hover:bg-primary/5 text-muted-foreground/80 hover:text-foreground"
                              }`}
                            >
                              <IconComponent
                                className={`size-3.5 transition-transform shrink-0 ${
                                  isHovered
                                    ? "text-blue-600 dark:text-blue-400 scale-105"
                                    : "text-muted-foreground group-hover:text-foreground"
                                }`}
                              />
                              <span
                                className={`text-xs tracking-tight truncate transition-colors ${
                                  isHovered
                                    ? "font-bold text-foreground"
                                    : "font-medium group-hover:text-foreground"
                                }`}
                              >
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* COLLAPSED MODE: FLOATING LIQUID GLASS HEADINGS FLYOUT SUB-MENU */}
      {collapsed && collapsedFlyoutOpen && collapsedFlyoutPos && (
        <div
          style={{ top: collapsedFlyoutPos.top, left: collapsedFlyoutPos.left }}
          onMouseEnter={handleFlyoutContainerEnter}
          onMouseLeave={handleFlyoutContainerLeave}
          className="fixed z-50 p-2.5 rounded-2xl w-[204px] bg-gradient-to-b from-white/95 via-white/85 to-white/75 dark:from-zinc-900/95 dark:via-zinc-900/90 dark:to-zinc-950/85 backdrop-blur-2xl backdrop-saturate-180 border border-white/80 dark:border-white/15 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.18),_inset_0_1px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7),_inset_0_1px_1px_rgba(255,255,255,0.18)] select-none animate-in fade-in-0 zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center gap-1.5 px-2 py-1 mb-1.5 border-b border-border/40 text-[11px] font-bold tracking-tight text-foreground/90">
            <div className="p-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Heading className="size-3.5" />
            </div>
            <span>Headings</span>
          </div>

          {/* Mini Branched Tree for H1, H2, H3 (Locked to 44px Row Height) */}
          <div className="relative flex flex-col">
            {/* SVG Tree Connector - 44px Per Row Mathematics */}
            <svg
              className="absolute top-0 left-0 overflow-visible pointer-events-none"
              width="30"
              height="132"
              aria-hidden="true"
            >
              {/* Trunk line: runs down to H3's curve start (y = 102) */}
              <path
                className="stroke-border/70 dark:stroke-white/15"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
                d="M 14 4 V 102"
              />
              {/* Base curves into each heading option (center Y = idx * 44 + 22) */}
              {HEADING_CHILDREN.map((_, idx) => {
                const cY = idx * 44 + 22;
                return (
                  <path
                    key={idx}
                    className="stroke-border/70 dark:stroke-white/15"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    fill="none"
                    d={`M 14 ${cY - 8} A 8 8 0 0 0 22 ${cY} H 28`}
                  />
                );
              })}
              {/* Animated blue reach line when hovering a sub-heading */}
              {activeFlyoutIndex !== null && (
                <path
                  className="stroke-blue-500 dark:stroke-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                  d={`M 14 4 V ${activeFlyoutIndex * 44 + 14} A 8 8 0 0 0 22 ${
                    activeFlyoutIndex * 44 + 22
                  } H 28`}
                />
              )}
            </svg>

            {/* Sub-heading Buttons - Locked to exactly h-[44px] */}
            {HEADING_CHILDREN.map((sub, idx) => {
              const SubIcon = sub.icon;
              const isActive = activeFlyoutIndex === idx;

              return (
                <button
                  key={sub.level}
                  type="button"
                  onClick={() => handleAdd("heading", { text: "", level: sub.level })}
                  onMouseEnter={() => setActiveFlyoutIndex(idx)}
                  onMouseLeave={() => setActiveFlyoutIndex(null)}
                  style={{ height: 44, paddingLeft: 30 }}
                  className={`group flex items-center gap-2.5 pr-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    isActive
                      ? "bg-blue-500/10 dark:bg-blue-500/15"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div
                    className={`p-1 rounded-lg transition-all shrink-0 ${
                      isActive
                        ? "bg-blue-500 text-white shadow-xs scale-105"
                        : "bg-muted/80 text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    <SubIcon className="size-3.5" />
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
        </div>
      )}

      {/* RESPONSIVE LIQUID GLASS TOOLTIP (COLLAPSED SCRUBBING MODE) */}
      {collapsed && !collapsedFlyoutOpen && tooltipText && tooltipPos && (
        <div
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
          className="fixed z-50 px-3 py-1.5 rounded-full glass-tooltip text-xs font-semibold text-foreground flex items-center gap-1.5 select-none transition-all duration-150 ease-out pointer-events-none animate-in fade-in-0 zoom-in-95"
        >
          <div className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span>{tooltipText}</span>
        </div>
      )}
    </>
  );
}
