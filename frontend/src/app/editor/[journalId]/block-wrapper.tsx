"use client";

import React, { useRef, useState } from "react";
import { Copy, GripVertical, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useDocumentStore } from "./use-document-store";
import SlashMenu from "./slash-menu";

interface BlockWrapperProps {
  id: string;
  index: number;
  provided: any;
  previewMode: boolean;
  children: React.ReactNode;
}

export default function BlockWrapper({
  id,
  index,
  provided,
  previewMode,
  children,
}: BlockWrapperProps) {
  const { duplicateBlock, deleteBlock, addBlock, moveBlock, blocks } = useDocumentStore();
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const plusBtnRef = useRef<HTMLButtonElement>(null);

  if (previewMode) {
    return <div className="w-full select-text">{children}</div>;
  }

  const handleToggleSlashMenu = () => {
    if (!showSlashMenu && plusBtnRef.current) {
      const rect = plusBtnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;

      // If space below is less than 320px, open popover UPWARDS above button
      if (spaceBelow < 320) {
        setMenuPos({ top: Math.max(10, rect.top - 310), left: Math.min(rect.left, window.innerWidth - 260) });
      } else {
        setMenuPos({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 260) });
      }
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleSelectBlockType = (type: string) => {
    addBlock(index + 1, type);
    setShowSlashMenu(false);
  };

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      className="group relative flex items-start gap-3 w-full pl-16 pr-4 py-3 border border-transparent hover:border-border/40 hover:bg-muted/10 rounded-xl transition-all"
    >
      {/* Side Action Panel (visible on hover) - anchored at left-3 inside generous pl-16 (64px) margin buffer */}
      <div className="absolute left-3 top-3.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-none z-10">
        {/* Drag Handle */}
        <div
          {...provided.dragHandleProps}
          className="p-1 hover:bg-muted text-muted-foreground/60 hover:text-foreground rounded cursor-grab active:cursor-grabbing transition-colors"
          title="Drag to reorder"
        >
          <GripVertical className="size-3.5" />
        </div>

        {/* Add Block */}
        <button
          ref={plusBtnRef}
          onClick={handleToggleSlashMenu}
          className="p-1 hover:bg-muted text-muted-foreground/60 hover:text-primary rounded transition-colors cursor-pointer"
          title="Add block below"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {/* Main Block Content */}
      <div className="flex-1 min-w-0">{children}</div>

      {/* Block Utility Actions Panel (visible on hover) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-none border border-border/50 bg-background/80 shadow-xs px-1.5 py-1 rounded-lg shrink-0 mt-1">
        <button
          onClick={() => moveBlock(index, index - 1)}
          disabled={index === 0}
          className="p-1 hover:bg-muted text-muted-foreground/60 hover:text-foreground rounded transition-colors disabled:opacity-30 cursor-pointer"
          title="Move up"
        >
          <ChevronUp className="size-3.5" />
        </button>
        <button
          onClick={() => moveBlock(index, index + 1)}
          disabled={index === blocks.length - 1}
          className="p-1 hover:bg-muted text-muted-foreground/60 hover:text-foreground rounded transition-colors disabled:opacity-30 cursor-pointer"
          title="Move down"
        >
          <ChevronDown className="size-3.5" />
        </button>
        <div className="w-px h-3.5 bg-border/60 mx-1" />
        <button
          onClick={() => duplicateBlock(id)}
          className="p-1 hover:bg-muted text-muted-foreground/60 hover:text-foreground rounded transition-colors cursor-pointer"
          title="Duplicate block"
        >
          <Copy className="size-3.5" />
        </button>
        <button
          onClick={() => deleteBlock(id)}
          className="p-1 hover:bg-muted text-muted-foreground/60 hover:text-destructive rounded transition-colors cursor-pointer"
          title="Delete block"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* VIEWPORT-SMART DYNAMIC FLOATING SLASH MENU POPOVER */}
      {showSlashMenu && menuPos && (
        <div
          style={{ top: menuPos.top, left: menuPos.left }}
          className="fixed z-50 animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <SlashMenu
            onSelect={handleSelectBlockType}
            onClose={() => setShowSlashMenu(false)}
          />
        </div>
      )}
    </div>
  );
}
