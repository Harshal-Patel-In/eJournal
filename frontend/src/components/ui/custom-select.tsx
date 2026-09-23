"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  className = "",
  triggerClassName = "",
  icon,
  disabled = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Selected option display text
  const selectedOption = options.find((opt) => opt.value === value);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen((prev) => !prev);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      const currentIndex = options.findIndex((opt) => opt.value === value);
      const nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
      if (options[nextIndex]) {
        onChange(options[nextIndex].value);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      const currentIndex = options.findIndex((opt) => opt.value === value);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
      if (options[prevIndex]) {
        onChange(options[prevIndex].value);
      }
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full min-w-[190px] h-9 px-3.5 rounded-2xl bg-card border border-border/80 text-xs font-medium text-foreground hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20 flex items-center justify-between gap-2.5 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${triggerClassName}`}
      >
        <span className="flex items-center gap-2 truncate">
          {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
          <span className={`truncate ${!selectedOption && placeholder ? "text-muted-foreground" : "text-foreground"}`}>
            {displayText}
          </span>
        </span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180 text-foreground" : ""
          }`}
        />
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 mt-1.5 min-w-[200px] max-h-60 overflow-y-auto rounded-2xl bg-card/95 backdrop-blur-md border border-border/90 shadow-2xl p-1 z-50 animate-in fade-in-0 zoom-in-95 duration-150 origin-top"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value)}
                className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground hover:bg-muted/60"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
