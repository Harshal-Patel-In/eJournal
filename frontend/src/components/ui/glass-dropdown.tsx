"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { InlineMathText } from "@/components/inline-math-text";

export interface DropdownOption {
  value: string;
  label: React.ReactNode | string;
  badge?: string;
  count?: number;
  icon?: React.ReactNode;
}

interface GlassDropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  align?: "left" | "right";
  renderMath?: boolean;
}

export function GlassDropdown({
  value,
  options,
  onChange,
  placeholder = "Select...",
  icon,
  className = "",
  align = "left",
  renderMath = true,
}: GlassDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const renderLabel = (label: React.ReactNode | string) => {
    if (typeof label === "string" && renderMath) {
      return <InlineMathText text={label} />;
    }
    return label;
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className || "w-auto min-w-[140px]"}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-9 px-3 rounded-xl bg-background hover:bg-muted/40 border border-border text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 flex items-center justify-between gap-2.5 transition-all cursor-pointer select-none shadow-2xs whitespace-nowrap"
      >
        <div className="flex items-center gap-2 truncate text-left">
          {icon || selectedOption?.icon}
          {selectedOption?.badge && (
            <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-[10px] shrink-0 border border-indigo-500/20">
              {selectedOption.badge}
            </span>
          )}
          <span className="truncate font-semibold text-foreground">
            {selectedOption ? renderLabel(selectedOption.label) : placeholder}
          </span>
          {selectedOption?.count !== undefined && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 font-mono font-bold">
              {selectedOption.count}
            </span>
          )}
        </div>
        <ChevronDown className={`size-3.5 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 z-50 min-w-[220px] w-full max-w-md p-1.5 rounded-2xl bg-popover text-popover-foreground backdrop-blur-2xl border border-border shadow-2xl ring-1 ring-black/5 animate-in fade-in-50 zoom-in-95 duration-150 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar p-0.5">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2.5 text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-primary/10 text-primary font-bold shadow-2xs"
                      : "text-foreground hover:bg-muted/80 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.icon}
                    {opt.badge && (
                      <span
                        className={`px-1.5 py-0.5 rounded-md font-mono font-bold text-[10px] shrink-0 border ${
                          isSelected
                            ? "bg-primary/20 text-primary border-primary/30"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {opt.badge}
                      </span>
                    )}
                    <span className="truncate">{renderLabel(opt.label)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {opt.count !== undefined && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted font-mono font-bold text-muted-foreground">
                        {opt.count}
                      </span>
                    )}
                    {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
