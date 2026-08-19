"use client";

import React, { useEffect, useRef, useState } from "react";
import { Copy, GripVertical, Plus, Trash2, ChevronUp, ChevronDown, MoreHorizontal } from "lucide-react";
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
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [actionMenuPos, setActionMenuPos] = useState<{ top: number; left: number } | null>(null);

  const plusBtnRef = useRef<HTMLButtonElement>(null);
  const gripBtnRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside
  useEffect(() => {
    if (!showActionMenu && !showSlashMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      setShowActionMenu(false);
      setShowSlashMenu(false);
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [showActionMenu, showSlashMenu]);

  if (previewMode) {
    return (
      <div
        id={`block-${id}`}
        ref={provided?.innerRef}
        {...provided?.draggableProps}
        className="w-full select-text"
      >
        {children}
      </div>
    );
  }

  const handleToggleSlashMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActionMenu(false);
    if (!showSlashMenu && plusBtnRef.current) {
      const rect = plusBtnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;

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

  const handleToggleActionMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSlashMenu(false);
    if (!showActionMenu && gripBtnRef.current) {
      const rect = gripBtnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;

      if (spaceBelow < 200) {
        setActionMenuPos({ top: Math.max(10, rect.top - 170), left: Math.min(rect.left, window.innerWidth - 200) });
      } else {
        setActionMenuPos({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 200) });
      }
      setShowActionMenu(true);
    } else {
      setShowActionMenu(false);
    }
  };

  const handleSelectBlockType = (type: string) => {
    addBlock(index + 1, type);
    setShowSlashMenu(false);
  };

  return (
    <div
      id={`block-${id}`}
      ref={provided.innerRef}
      {...provided.draggableProps}
      className="group relative w-full border border-transparent hover:border-border/30 hover:bg-muted/5 rounded-xl transition-all"
    >
      {/* Notion-Style Compact Left Gutter (Guaranteed 8px outside block card edge) */}
      <div className="absolute right-[calc(100%+8px)] top-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 select-none z-20 bg-background/95 dark:bg-zinc-900/95 backdrop-blur-md border border-border/70 shadow-xs px-1 py-0.5 rounded-lg">
        {/* Add Block */}
        <button
          ref={plusBtnRef}
          onClick={handleToggleSlashMenu}
          className="p-1 hover:bg-muted text-muted-foreground/60 hover:text-primary rounded transition-colors cursor-pointer"
          title="Add block below"
        >
          <Plus className="size-3.5" />
        </button>

        {/* Drag Handle + Click for Action Menu */}
        <div
          ref={gripBtnRef}
          {...provided.dragHandleProps}
          onClick={handleToggleActionMenu}
          className="p-1 hover:bg-muted text-muted-foreground/60 hover:text-foreground rounded cursor-grab active:cursor-grabbing transition-colors"
          title="Drag to reorder or click for actions"
        >
          <GripVertical className="size-3.5" />
        </div>
      </div>

      {/* Main Block Content (100% Full Width, 0px Squeezed, 0px Overlapped) */}
      <div className="w-full select-text">{children}</div>

      {/* BLOCK ACTION DROPDOWN MENU (Move Up, Move Down, Duplicate, Delete) */}
      {showActionMenu && actionMenuPos && (
        <div
          style={{ top: actionMenuPos.top, left: actionMenuPos.left }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 min-w-[160px] p-1.5 rounded-xl border border-border/80 bg-background/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-xl animate-in fade-in-0 zoom-in-95 duration-150 flex flex-col gap-0.5 text-xs select-none"
        >
          <button
            onClick={() => {
              moveBlock(index, index - 1);
              setShowActionMenu(false);
            }}
            disabled={index === 0}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted font-medium text-foreground disabled:opacity-30 cursor-pointer transition-colors"
          >
            <ChevronUp className="size-3.5 text-muted-foreground" />
            <span>Move Up</span>
          </button>
          <button
            onClick={() => {
              moveBlock(index, index + 1);
              setShowActionMenu(false);
            }}
            disabled={index === blocks.length - 1}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted font-medium text-foreground disabled:opacity-30 cursor-pointer transition-colors"
          >
            <ChevronDown className="size-3.5 text-muted-foreground" />
            <span>Move Down</span>
          </button>
          <button
            onClick={() => {
              duplicateBlock(id);
              setShowActionMenu(false);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted font-medium text-foreground cursor-pointer transition-colors"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Duplicate</span>
          </button>
          <div className="h-px bg-border/60 my-0.5" />
          <button
            onClick={() => {
              deleteBlock(id);
              setShowActionMenu(false);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 font-semibold text-rose-600 dark:text-rose-400 cursor-pointer transition-colors"
          >
            <Trash2 className="size-3.5" />
            <span>Delete Block</span>
          </button>
        </div>
      )}

      {/* VIEWPORT-SMART DYNAMIC FLOATING SLASH MENU POPOVER */}
      {showSlashMenu && menuPos && (
        <div
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={(e) => e.stopPropagation()}
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
