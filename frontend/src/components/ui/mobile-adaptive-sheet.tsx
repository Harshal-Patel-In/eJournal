"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";

export interface MobileAdaptiveSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  preventBackdropClose?: boolean;
  className?: string;
}

/**
 * MobileAdaptiveSheet — Universal High-Performance Adaptive Sheet / Modal Primitive.
 *
 * Grounded in:
 * - Apple Human Interface Guidelines (Bottom Sheet & Drag Affordances)
 * - Emil Kowalski Design Engineering (cubic-bezier springs, scale(0.95) entry, interruptible transitions)
 * - Behavioral Ergonomics (Thumb-accessible, velocity-aware momentum dismissal, zero layout thrashing)
 */
export function MobileAdaptiveSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = "sm:max-w-lg",
  preventBackdropClose = false,
  className = "",
}: MobileAdaptiveSheetProps) {
  const [startY, setStartY] = useState<number | null>(null);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartTimeRef = useRef<number>(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock body scroll cleanly when open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    } else {
      setCurrentY(0);
      setIsDragging(false);
    }
  }, [isOpen]);

  // Handle global Escape key dismissal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Touch Gesture Engine for Mobile Bottom Sheet Drag-to-Dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    dragStartTimeRef.current = Date.now();
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === null) return;
    const deltaY = e.touches[0].clientY - startY;

    if (deltaY > 0) {
      // Natural downward drag
      setCurrentY(deltaY);
    } else {
      // Subtle rubber-band resistance when pulling upward
      setCurrentY(deltaY * 0.2);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const timeTaken = Math.max(1, Date.now() - dragStartTimeRef.current);
    const velocity = currentY / timeTaken;

    // Velocity-based momentum flick (velocity > 0.12) OR distance threshold (> 90px)
    if (currentY > 90 || velocity > 0.12) {
      onClose();
    } else {
      // Spring snap back to neutral
      setCurrentY(0);
    }
    setStartY(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center select-none"
    >
      {/* Frosted Glass Darkened Backdrop */}
      <div
        onClick={() => {
          if (!preventBackdropClose) onClose();
        }}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
      />

      {/* Adaptive Sheet / Centered Modal Surface */}
      <div
        ref={sheetRef}
        style={{
          transform: `translateY(${Math.max(0, currentY)}px)`,
          transition: isDragging ? "none" : "transform 240ms cubic-bezier(0.32, 0.72, 0, 1)",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
        }}
        className={`relative z-10 w-full ${maxWidth} bg-card text-card-foreground border-t sm:border border-border/80 rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in sm:zoom-in-95 duration-200 select-text ${className}`}
      >
        {/* Mobile Drag Indicator Handle (Hidden on Desktop/Tablet) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="sm:hidden pt-3 pb-1.5 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
          title="Drag down to dismiss"
        >
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30 active:bg-muted-foreground/60 transition-colors" />
        </div>

        {/* Header Bar with 44px Close Touch Target */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/70 shrink-0">
          <div className="min-w-0 pr-3">
            <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight truncate font-serif">
              {title}
            </h2>
            {subtitle && (
              <div className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-9 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0 tap-feedback touch-target-44"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Document Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 overscroll-contain space-y-4">
          {children}
        </div>

        {/* Optional Pinned Bottom Footer Action Bar */}
        {footer && (
          <div className="px-5 py-3 border-t border-border/70 bg-muted/30 shrink-0 flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

