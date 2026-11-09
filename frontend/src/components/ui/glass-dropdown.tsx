"use client";

import React, { useEffect, useRef, useState, useId, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { InlineMathText } from "@/components/inline-math-text";

export interface DropdownOption {
  value: string;
  label: React.ReactNode | string;
  badge?: string;
  count?: number;
  icon?: React.ReactNode;
  description?: string;
}

interface GlassDropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  align?: "left" | "right";
  renderMath?: boolean;
  size?: "sm" | "md" | "default";
  showBadgeInTrigger?: boolean;
  disabled?: boolean;
}

export function GlassDropdown({
  value,
  options,
  onChange,
  placeholder = "Select...",
  icon,
  className = "",
  buttonClassName = "",
  menuClassName = "",
  align = "left",
  renderMath = true,
  size = "default",
  showBadgeInTrigger,
  disabled = false,
}: GlassDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const isSmall = size === "sm";
  const shouldShowBadgeInTrigger = showBadgeInTrigger !== undefined ? showBadgeInTrigger : !isSmall;

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const selectedOption = selectedIndex !== -1 ? options[selectedIndex] : undefined;

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();

    // If button is scrolled completely out of viewport, close dropdown
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false);
      return;
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedMenuHeight = 260;
    const flipUp = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;

    const style: React.CSSProperties = {
      position: "fixed",
      zIndex: 999999,
    };

    if (flipUp) {
      style.bottom = `${Math.round(window.innerHeight - rect.top + 4)}px`;
    } else {
      style.top = `${Math.round(rect.bottom + 4)}px`;
    }

    if (align === "right") {
      style.right = `${Math.max(8, Math.round(window.innerWidth - rect.right))}px`;
    } else {
      // Left aligned: clamp so menu does not overflow right screen boundary
      const maxLeft = Math.max(8, window.innerWidth - 240);
      style.left = `${Math.min(Math.round(rect.left), maxLeft)}px`;
    }

    setMenuStyle(style);
  }, [align]);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const renderLabel = (label: React.ReactNode | string) => {
    if (typeof label === "string" && renderMath) {
      return <InlineMathText text={label} />;
    }
    return label;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        updatePosition();
        setHighlightedIndex(selectedIndex !== -1 ? selectedIndex : 0);
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape" || e.key === "Tab") {
      setIsOpen(false);
      buttonRef.current?.focus();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < options.length) {
        onChange(options[highlightedIndex].value);
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }
  };

  const defaultButtonStyles = isSmall
    ? "h-7 px-2.5 rounded-lg gap-1.5 text-xs font-semibold"
    : "h-8 px-3 rounded-lg gap-2 text-xs font-semibold";

  const defaultContainerStyles = isSmall
    ? "w-auto min-w-fit"
    : "w-auto min-w-[140px]";

  const defaultMenuStyles = isSmall
    ? "min-w-[170px]"
    : "min-w-[200px] max-w-md";

  return (
    <div
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
      className={`relative inline-block ${className || defaultContainerStyles}`}
    >
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        onClick={() => {
          if (!isOpen) {
            updatePosition();
            setHighlightedIndex(selectedIndex !== -1 ? selectedIndex : 0);
          }
          setIsOpen(!isOpen);
        }}
        className={`w-full rounded-lg ${buttonClassName || defaultButtonStyles} bg-card hover:bg-muted/60 border border-border text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
          isOpen ? "ring-2 ring-ring border-primary bg-muted/50" : ""
        } flex items-center justify-between transition-[background-color,border-color] duration-120 cursor-pointer select-none shadow-2xs whitespace-nowrap active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate text-left">
          {icon || selectedOption?.icon}
          {shouldShowBadgeInTrigger && selectedOption?.badge && (
            <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary font-mono font-bold text-[10px] shrink-0 border border-primary/20">
              {selectedOption.badge}
            </span>
          )}
          <span className="truncate text-foreground font-semibold">
            {selectedOption ? renderLabel(selectedOption.label) : placeholder}
          </span>
          {selectedOption?.count !== undefined && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-mono font-semibold shrink-0">
              {selectedOption.count}
            </span>
          )}
        </div>
        <ChevronDown
          className={`${isSmall ? "size-3" : "size-3.5"} text-muted-foreground transition-transform duration-120 shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen &&
        mounted &&
        createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            style={menuStyle}
            className={`p-1 rounded-md bg-popover text-popover-foreground border border-border shadow-md animate-in fade-in-0 zoom-in-95 duration-120 select-none ${
              menuClassName || defaultMenuStyles
            }`}
          >
            <div className="max-h-64 overflow-y-auto space-y-0.5 custom-scrollbar p-0.5">
              {options.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      buttonRef.current?.focus();
                    }}
                    className={`w-full px-2.5 py-1.5 rounded text-xs flex items-center justify-between gap-2.5 text-left transition-colors duration-100 cursor-pointer ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold"
                        : isHighlighted
                        ? "bg-muted text-foreground font-medium"
                        : "text-foreground hover:bg-muted font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      {opt.icon}
                      {opt.badge && (
                        <span
                          className={`px-1.5 py-0.2 rounded font-mono font-bold text-[10px] shrink-0 border ${
                            isSelected
                              ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{renderLabel(opt.label)}</span>
                        {opt.description && (
                          <span className={`text-[10px] font-normal leading-tight truncate ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                            {opt.description}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.count !== undefined && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {opt.count}
                        </span>
                      )}
                      {isSelected && <Check className="size-3.5 text-primary-foreground shrink-0 stroke-[2.5]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
