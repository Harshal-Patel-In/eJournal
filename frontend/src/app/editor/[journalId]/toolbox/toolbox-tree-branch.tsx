"use client";

import React, { useRef } from "react";
import { ChevronRight } from "lucide-react";
import {
  type CategoryGroup,
  type ToolItem,
  HEADING_CHILDREN,
} from "./toolbox-config";

const ROW_H = 34;
const TRUNK_X = 18;
const CURVE_R = 9;
const END_X = 28;

const SUB_ROW_H = 30;
const SUB_TRUNK_X = 28;
const SUB_CURVE_R = 7;
const SUB_END_X = 38;
const TOTAL_SUB_H = HEADING_CHILDREN.length * SUB_ROW_H;

interface ToolboxTreeBranchProps {
  category: CategoryGroup;
  headingsOpen: boolean;
  onSetHeadingsOpen: (open: boolean) => void;
  hoveredItemId: string | null;
  onHoverItem: (id: string | null) => void;
  activeSubBranch: number | null;
  onHoverSubBranch: (idx: number | null) => void;
  onAdd: (type: string, payload: Record<string, unknown>) => void;
}

export function ToolboxTreeBranch({
  category,
  headingsOpen,
  onSetHeadingsOpen,
  hoveredItemId,
  onHoverItem,
  activeSubBranch,
  onHoverSubBranch,
  onAdd,
}: ToolboxTreeBranchProps) {
  const isStructure = category.id === "structure";
  const catTotalH =
    category.items.length * ROW_H + (isStructure && headingsOpen ? TOTAL_SUB_H : 0);

  const headingsTimerRef = useRef<NodeJS.Timeout | null>(null);

  const getItemY = (idx: number) => {
    if (isStructure && idx > 0 && headingsOpen) {
      return idx * ROW_H + TOTAL_SUB_H;
    }
    return idx * ROW_H;
  };

  const getItemCenterY = (idx: number) => getItemY(idx) + ROW_H / 2;

  // Active item in this category (if any)
  const activeHoveredItem = category.items.find((item) => item.id === hoveredItemId);
  const isCategoryActive =
    Boolean(activeHoveredItem) || (isStructure && headingsOpen);

  // Dynamic marker style matching the hovered item's color
  const markerClass = activeHoveredItem
    ? activeHoveredItem.categoryAccent.markerClass
    : "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]";

  // Headings hover-unfold handlers with 200ms grace period
  const handleHeadingsMouseEnter = () => {
    if (headingsTimerRef.current) clearTimeout(headingsTimerRef.current);
    onSetHeadingsOpen(true);
  };

  const handleHeadingsMouseLeave = () => {
    if (headingsTimerRef.current) clearTimeout(headingsTimerRef.current);
    headingsTimerRef.current = setTimeout(() => {
      onSetHeadingsOpen(false);
      onHoverSubBranch(null);
    }, 200);
  };

  return (
    <div className="flex flex-col relative select-none">
      {/* Category Section Header */}
      <div className="relative pl-5 pr-2 pt-1 pb-1 flex items-center justify-between">
        {/* Dynamic Category Marker Bar (Harmonized with Hovered Item Color) */}
        {isCategoryActive && (
          <div
            className={`absolute left-[8px] top-1.5 bottom-1.5 w-[2.5px] rounded-full transition-all duration-200 animate-in fade-in-0 ${markerClass}`}
            aria-hidden="true"
          />
        )}
        <span
          className={`text-[11px] uppercase tracking-wider transition-colors duration-150 ${
            activeHoveredItem
              ? `${activeHoveredItem.categoryAccent.color} font-bold`
              : isCategoryActive
              ? "font-bold text-blue-600 dark:text-blue-400"
              : "font-bold text-foreground/80 dark:text-zinc-300"
          }`}
        >
          {category.label}
        </span>
      </div>

      {/* Mathematical SVG Tree Rail & Buttons */}
      <div className="relative">
        {/* SVG Curved Branch Rail */}
        <svg
          className="absolute top-0 left-0 overflow-visible pointer-events-none transition-all duration-200"
          width={END_X + 2}
          height={catTotalH}
          aria-hidden="true"
        >
          {/* Main Trunk Line */}
          <path
            className="stroke-border dark:stroke-white/15"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            d={`M ${TRUNK_X} 0 V ${
              getItemCenterY(category.items.length - 1) - CURVE_R
            }`}
          />

          {/* Base Curved Arcs into each tool */}
          {category.items.map((_, k) => {
            const cY = getItemCenterY(k);
            const d = `M ${TRUNK_X} ${cY - CURVE_R} A ${CURVE_R} ${CURVE_R} 0 0 0 ${
              TRUNK_X + CURVE_R
            } ${cY} H ${END_X}`;
            return (
              <path
                key={k}
                className="stroke-border dark:stroke-white/15"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                d={d}
              />
            );
          })}

          {/* Luminous Reach Laser Line on Hover (Chromatic Color Matched!) */}
          {category.items.map((item, k) => {
            const isHovered = hoveredItemId === item.id;
            const cY = getItemCenterY(k);
            const d = `M ${TRUNK_X} 0 V ${cY - CURVE_R} A ${CURVE_R} ${CURVE_R} 0 0 0 ${
              TRUNK_X + CURVE_R
            } ${cY} H ${END_X}`;
            const pathLen =
              cY - CURVE_R + (Math.PI * CURVE_R) / 2 + (END_X - TRUNK_X - CURVE_R);

            return (
              <path
                key={item.id}
                className={item.categoryAccent.strokeClass}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                d={d}
                style={{
                  strokeDasharray: pathLen,
                  strokeDashoffset: isHovered ? 0 : pathLen,
                  filter: isHovered
                    ? `drop-shadow(0 0 6px ${item.categoryAccent.glow})`
                    : "none",
                  transition:
                    "stroke-dashoffset 220ms cubic-bezier(0.16, 1, 0.3, 1), filter 150ms ease",
                }}
              />
            );
          })}
        </svg>

        {/* Tool Items Column */}
        <div className="flex flex-col">
          {category.items.map((item: ToolItem) => {
            const IconComponent = item.icon;
            const isHovered = hoveredItemId === item.id;

            // Headings Item: Special Accordion Container with Hover-Unfold
            if (item.hasChildren) {
              return (
                <div
                  key={item.id}
                  className="flex flex-col"
                  onMouseEnter={handleHeadingsMouseEnter}
                  onMouseLeave={handleHeadingsMouseLeave}
                >
                  <button
                    type="button"
                    onClick={() => onSetHeadingsOpen(!headingsOpen)}
                    onMouseEnter={() => onHoverItem(item.id)}
                    onMouseLeave={() => onHoverItem(null)}
                    style={{ height: ROW_H, paddingLeft: END_X + 2 }}
                    className={`group flex items-center justify-between w-full pr-2 text-left transition-all cursor-pointer rounded-xl ${
                      isHovered || headingsOpen
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold"
                        : "hover:bg-muted/60 text-foreground/80 hover:text-foreground font-medium"
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
                      <span className="text-xs tracking-tight truncate">
                        {item.label}
                      </span>
                    </div>

                    <ChevronRight
                      className={`size-3 transition-transform duration-200 shrink-0 ${
                        headingsOpen
                          ? "rotate-90 text-blue-600 dark:text-blue-400"
                          : "rotate-0 text-muted-foreground/60"
                      }`}
                    />
                  </button>

                  {/* Smooth Folding Sub-Tree for H1, H2, H3 */}
                  <div
                    style={{ gridTemplateRows: headingsOpen ? "1fr" : "0fr" }}
                    className="grid transition-[grid-template-rows] duration-200 ease-out"
                  >
                    <div className="overflow-hidden">
                      <div className="relative flex flex-col py-0.5">
                        {/* Nested Sub-Tree SVG Connector */}
                        <svg
                          className="absolute top-0 left-0 overflow-visible pointer-events-none"
                          width={SUB_END_X + 2}
                          height={TOTAL_SUB_H}
                          aria-hidden="true"
                        >
                          <path
                            className="stroke-blue-500/30 dark:stroke-blue-400/30"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            fill="none"
                            d={`M ${SUB_TRUNK_X} 0 V ${
                              (HEADING_CHILDREN.length - 1) * SUB_ROW_H +
                              SUB_ROW_H / 2 -
                              SUB_CURVE_R
                            }`}
                          />

                          {HEADING_CHILDREN.map((_, sIdx) => {
                            const scY = sIdx * SUB_ROW_H + SUB_ROW_H / 2;
                            const sd = `M ${SUB_TRUNK_X} ${
                              scY - SUB_CURVE_R
                            } A ${SUB_CURVE_R} ${SUB_CURVE_R} 0 0 0 ${
                              SUB_TRUNK_X + SUB_CURVE_R
                            } ${scY} H ${SUB_END_X}`;
                            return (
                              <path
                                key={sIdx}
                                className="stroke-blue-500/30 dark:stroke-blue-400/30"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                fill="none"
                                d={sd}
                              />
                            );
                          })}

                          {activeSubBranch !== null && (
                            <path
                              className="stroke-blue-500 dark:stroke-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.7)]"
                              strokeWidth="2"
                              strokeLinecap="round"
                              fill="none"
                              d={`M ${SUB_TRUNK_X} 0 V ${
                                activeSubBranch * SUB_ROW_H +
                                SUB_ROW_H / 2 -
                                SUB_CURVE_R
                              } A ${SUB_CURVE_R} ${SUB_CURVE_R} 0 0 0 ${
                                SUB_TRUNK_X + SUB_CURVE_R
                              } ${
                                activeSubBranch * SUB_ROW_H + SUB_ROW_H / 2
                              } H ${SUB_END_X}`}
                            />
                          )}
                        </svg>

                        {/* H1, H2, H3 Buttons */}
                        {HEADING_CHILDREN.map((sub, sIdx) => {
                          const SubIcon = sub.icon;
                          const isSubActive = activeSubBranch === sIdx;

                          return (
                            <button
                              key={sub.level}
                              type="button"
                              onClick={() =>
                                onAdd("heading", { text: "", level: sub.level })
                              }
                              onMouseEnter={() => onHoverSubBranch(sIdx)}
                              onMouseLeave={() => onHoverSubBranch(null)}
                              style={{
                                height: SUB_ROW_H,
                                paddingLeft: SUB_END_X + 2,
                              }}
                              className={`group flex items-center justify-between w-full pr-2 text-left transition-all cursor-pointer rounded-lg ${
                                isSubActive
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold"
                                  : "hover:bg-muted/50 text-muted-foreground hover:text-foreground font-medium"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <SubIcon className="size-3 shrink-0" />
                                <span className="text-[11px] font-medium tracking-tight">
                                  {sub.label}
                                </span>
                              </div>
                              <span className="text-[9px] text-muted-foreground/60 group-hover:text-muted-foreground font-mono">
                                H{sub.level}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Regular Block Item with matched chromatic hover styling
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onAdd(item.type, item.payload)}
                onMouseEnter={() => onHoverItem(item.id)}
                onMouseLeave={() => onHoverItem(null)}
                style={{ height: ROW_H, paddingLeft: END_X + 2 }}
                className={`group flex items-center justify-between w-full pr-2 text-left transition-all cursor-pointer rounded-xl ${
                  isHovered
                    ? `${item.categoryAccent.bg} ${item.categoryAccent.color} font-semibold`
                    : "hover:bg-muted/60 text-foreground/80 hover:text-foreground font-medium"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <IconComponent
                    className={`size-3.5 transition-transform shrink-0 ${
                      isHovered
                        ? `${item.categoryAccent.color} scale-105`
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  />
                  <span className="text-xs tracking-tight truncate">
                    {item.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
