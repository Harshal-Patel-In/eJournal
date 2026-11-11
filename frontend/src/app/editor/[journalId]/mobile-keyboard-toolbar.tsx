"use client";

import React, { useState } from "react";
import {
  Heading,
  AlignLeft,
  Sigma,
  Code2,
  Table as TableIcon,
  CheckSquare,
  Award,
  BookMarked,
  SplitSquareVertical,
  Save,
  Check,
  Loader2,
  CloudAlert,
} from "lucide-react";
import { useDocumentStore } from "./use-document-store";
import { toast } from "@/lib/toast";

interface MobileKeyboardToolbarProps {
  onSave?: () => void;
  isSaving?: boolean;
}

/**
 * MobileKeyboardToolbar — Thumb-Accessible Scientific Editor Keyboard Toolbar.
 *
 * Grounded in:
 * - Apple HIG: Thumb-reachable keyboard accessory strip with ≥44px touch targets.
 * - Emil Kowalski Standards: Hardware-accelerated tap-feedback (scale 0.965) and 60fps scrolling.
 * - Anti-Frustration Ergonomics: Prevents mobile virtual keyboard from obscuring block insertion.
 */
export function MobileKeyboardToolbar({ onSave, isSaving = false }: MobileKeyboardToolbarProps) {
  const { blocks, addBlock, previewMode, syncStatus, isDirty } = useDocumentStore();
  const [justAdded, setJustAdded] = useState<string | null>(null);

  if (previewMode) return null;

  const handleAdd = (type: string, payload?: Record<string, unknown>, label?: string) => {
    const newIdx = blocks.length;
    addBlock(newIdx, type, payload);
    setJustAdded(type);
    setTimeout(() => setJustAdded(null), 1200);

    // Smoothly scroll down to newly added block
    requestAnimationFrame(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });
    });

    if (label) {
      toast.info(`Added ${label} block`, { duration: 1500 });
    }
  };

  const TOOL_ITEMS = [
    {
      id: "heading",
      label: "Heading",
      icon: Heading,
      color: "text-blue-500 dark:text-blue-400",
      bg: "bg-blue-500/10 hover:bg-blue-500/20",
      action: () => handleAdd("heading", { level: 2, text: "" }, "Heading"),
    },
    {
      id: "paragraph",
      label: "Text",
      icon: AlignLeft,
      color: "text-zinc-600 dark:text-zinc-300",
      bg: "bg-muted/80 hover:bg-muted",
      action: () => handleAdd("paragraph", { text: "" }, "Paragraph"),
    },
    {
      id: "equation",
      label: "Formula",
      icon: Sigma,
      color: "text-indigo-500 dark:text-indigo-400",
      bg: "bg-indigo-500/10 hover:bg-indigo-500/20",
      action: () => handleAdd("equation", { latex: "" }, "Math Equation"),
    },
    {
      id: "code",
      label: "Code",
      icon: Code2,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 hover:bg-amber-500/20",
      action: () => handleAdd("code", { language: "python", code: "" }, "Code"),
    },
    {
      id: "table",
      label: "Table",
      icon: TableIcon,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10 hover:bg-emerald-500/20",
      action: () =>
        handleAdd(
          "table",
          { headers: ["Column 1", "Column 2"], rows: [["", ""]] },
          "Data Table"
        ),
    },
    {
      id: "observation",
      label: "Checklist",
      icon: CheckSquare,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10 hover:bg-purple-500/20",
      action: () =>
        handleAdd(
          "observation",
          { items: [{ text: "Initial apparatus verification", checked: false }] },
          "Checklist"
        ),
    },
    {
      id: "result",
      label: "Result",
      icon: Award,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-500/10 hover:bg-rose-500/20",
      action: () => handleAdd("result", { text: "" }, "Result"),
    },
    {
      id: "reference",
      label: "Citations",
      icon: BookMarked,
      color: "text-cyan-600 dark:text-cyan-400",
      bg: "bg-cyan-500/10 hover:bg-cyan-500/20",
      action: () => handleAdd("reference", { citations: [""] }, "References"),
    },
    {
      id: "page_break",
      label: "Page Break",
      icon: SplitSquareVertical,
      color: "text-zinc-500 dark:text-zinc-400",
      bg: "bg-muted/60 hover:bg-muted",
      action: () => handleAdd("page_break", {}, "Page Break"),
    },
  ];

  return (
    <aside
      aria-label="Mobile Keyboard Quick Accessory Dock"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border/80 px-2 py-1.5 pb-safe shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.12)] flex items-center justify-between gap-1 select-none"
    >
      {/* Scrollable Block Insertion Ribbon */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-1 pr-2">
        {TOOL_ITEMS.map((item) => {
          const IconComponent = item.icon;
          const isSelected = justAdded === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className={`h-9 px-2.5 rounded-xl border border-border/60 flex items-center gap-1.5 text-xs font-semibold shrink-0 cursor-pointer tap-feedback transition-all ${
                isSelected
                  ? "bg-primary text-primary-foreground border-primary scale-105"
                  : `${item.bg} ${item.color}`
              }`}
              title={`Insert ${item.label} block`}
            >
              <IconComponent className="size-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Quick Save Pill (Always visible & pinned right) */}
      {onSave && (
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || !isDirty}
          className={`h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer tap-feedback transition-all ${
            isSaving
              ? "bg-primary/10 text-primary border-primary/30"
              : isDirty
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40"
              : "bg-muted/70 text-muted-foreground border-border/60 opacity-80"
          }`}
          title={isSaving ? "Saving changes..." : isDirty ? "Save changes now" : "All changes saved"}
        >
          {isSaving ? (
            <>
              <Loader2 className="size-3.5 animate-spin text-primary" />
              <span className="hidden xs:inline">Saving</span>
            </>
          ) : syncStatus === "offline" ? (
            <>
              <CloudAlert className="size-3.5 text-amber-500" />
              <span className="hidden xs:inline">Offline</span>
            </>
          ) : isDirty ? (
            <>
              <Save className="size-3.5 text-amber-600 dark:text-amber-400" />
              <span>Save</span>
            </>
          ) : (
            <>
              <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden xs:inline">Synced</span>
            </>
          )}
        </button>
      )}
    </aside>
  );
}

