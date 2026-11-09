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
        className={`w-full min-w-[180px] h-8 px-3 rounded-md bg-card border border-border text-xs font-medium text-foreground hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 flex items-center justify-between gap-2 shadow-2xs transition-[background-color,border-color] duration-120 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${triggerClassName}`}
      >
        <span className="flex items-center gap-2 truncate">
          {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
          <span className={`truncate ${!selectedOption && placeholder ? "text-muted-foreground" : "text-foreground font-semibold"}`}>
            {displayText}
          </span>
        </span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${
            isOpen ? "rotate-180 text-foreground" : ""
          }`}
        />
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 mt-1 min-w-[190px] max-h-60 overflow-y-auto rounded-md bg-popover text-popover-foreground border border-border shadow-md p-1 z-50 animate-in fade-in-0 zoom-in-95 duration-120 origin-top"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value)}
                className={`w-full px-2.5 py-1.5 rounded text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors duration-100 ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="size-3.5 text-primary-foreground shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
