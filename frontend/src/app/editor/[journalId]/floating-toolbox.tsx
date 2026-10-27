"use client";

import React, { useEffect, useState } from "react";
import { ChevronLeft, Layers } from "lucide-react";
import { useDocumentStore } from "./use-document-store";
import { CATEGORIES } from "./toolbox/toolbox-config";
import { ToolboxTreeBranch } from "./toolbox/toolbox-tree-branch";
import { ToolboxCollapsedRail } from "./toolbox/toolbox-collapsed-rail";

export default function FloatingToolbox() {
  const [collapsed, setCollapsed] = useState(false);
  const [headingsOpen, setHeadingsOpen] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [activeSubBranch, setActiveSubBranch] = useState<number | null>(null);

  const { blocks, addBlock, previewMode } = useDocumentStore();

  // Auto-collapse rail on compact laptop displays to preserve canvas margin
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      setCollapsed(true);
    }
  }, []);

  if (previewMode) return null;

  const handleAdd = (type: string, payload: Record<string, unknown>) => {
    addBlock(blocks.length, type, payload);
    setHeadingsOpen(false);
  };

  return (
    <aside
      aria-label="Document Toolbox"
      className={`fixed top-24 z-40 transition-all duration-300 ease-out select-none hidden md:block left-6 xl:left-8 2xl:left-[calc(50vw-448px-230px)] ${
        collapsed ? "w-11" : "w-[208px]"
      }`}
    >
      {/* Liquid Glass Surface Container with Apple Specular Bevel Highlights */}
      <div className="relative flex flex-col bg-gradient-to-b from-white/95 via-white/85 to-white/75 dark:from-zinc-900/95 dark:via-zinc-900/90 dark:to-zinc-950/85 backdrop-blur-2xl backdrop-saturate-180 border border-white/80 dark:border-white/15 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.12),_inset_0_1px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7),_inset_0_1px_1px_rgba(255,255,255,0.18)] rounded-2xl overflow-hidden transition-all duration-200">
        
        {/* Header (Expanded Mode) */}
        {!collapsed ? (
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-1.5 font-bold text-xs text-foreground tracking-tight">
              <div className="p-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Layers className="size-3.5" />
              </div>
              <span>Toolbox</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setCollapsed(true);
                setHeadingsOpen(false);
              }}
              aria-label="Collapse to Icon Rail"
              title="Collapse to compact icon dock"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all cursor-pointer"
            >
              <ChevronLeft className="size-3.5" />
            </button>
          </div>
        ) : null}

        {/* Body */}
        {collapsed ? (
          /* Collapsed Mode: Minimalist Icon Dock with Chromatic Scrubbing Tooltips */
          <ToolboxCollapsedRail
            onExpand={() => setCollapsed(false)}
            onAdd={handleAdd}
          />
        ) : (
          /* Expanded Mode: Integrated Mathematical SVG Tree Groups */
          <div className="relative p-2 flex flex-col gap-2 max-h-[calc(100vh-140px)] overflow-y-auto overflow-x-hidden custom-scrollbar">
            {/* Continuous Vertical Left Rail Guide Line */}
            <div
              className="absolute top-3 bottom-3 left-[9px] w-px bg-gradient-to-b from-border/70 via-border/50 to-transparent pointer-events-none"
              aria-hidden="true"
            />

            {CATEGORIES.map((cat) => (
              <ToolboxTreeBranch
                key={cat.id}
                category={cat}
                headingsOpen={headingsOpen}
                onSetHeadingsOpen={setHeadingsOpen}
                hoveredItemId={hoveredItemId}
                onHoverItem={setHoveredItemId}
                activeSubBranch={activeSubBranch}
                onHoverSubBranch={setActiveSubBranch}
                onAdd={handleAdd}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
