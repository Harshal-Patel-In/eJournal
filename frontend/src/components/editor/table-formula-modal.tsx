"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Calculator,
  X,
  Check,
  Sparkles,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineMathText } from "@/components/inline-math-text";
import {
  evaluateFormulaOnRow,
  LAB_FORMULA_PRESETS,
  type FormulaResult,
} from "@/lib/table-formula";

interface TableFormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetColIdx: number;
  headers: string[];
  rows: string[][];
  initialFormula?: string;
  initialPrecision?: string;
  onApplyFormula: (formula: string, calculatedValues: string[], precision: string) => void;
}

const QUICK_OPERATORS = [
  { label: "+", insert: " + ", title: "Addition" },
  { label: "−", insert: " - ", title: "Subtraction" },
  { label: "×", insert: " * ", title: "Multiplication" },
  { label: "÷", insert: " / ", title: "Division" },
  { label: "xʸ", insert: "^", title: "Power / Exponent" },
  { label: "(", insert: "(", title: "Open Parenthesis" },
  { label: ")", insert: ")", title: "Close Parenthesis" },
  { label: "π", insert: "pi", title: "Pi (3.14159...)" },
  { label: "e", insert: "e", title: "Euler's Number (2.71828...)" },
  { label: "g", insert: "g", title: "Gravity (9.80665 m/s²)" },
];

const PRECISION_OPTIONS = [
  { id: "auto", label: "Auto" },
  { id: "1", label: "0.0" },
  { id: "2", label: "0.00" },
  { id: "3", label: "0.000" },
  { id: "4", label: "0.0000" },
  { id: "scientific", label: "Sci" },
];

export function TableFormulaModal({
  isOpen,
  onClose,
  targetColIdx,
  headers,
  rows,
  initialFormula = "",
  initialPrecision = "2",
  onApplyFormula,
}: TableFormulaModalProps) {
  const [mounted, setMounted] = useState(false);
  const [formula, setFormula] = useState(initialFormula);
  const [angleMode, setAngleMode] = useState<"deg" | "rad">("deg");
  const [precision, setPrecision] = useState<string>(initialPrecision);
  const [previewResult, setPreviewResult] = useState<FormulaResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setFormula(initialFormula);
  }, [initialFormula, isOpen]);

  // Real-time Preview computation on Row 1 whenever formula or settings change
  useEffect(() => {
    if (!isOpen || rows.length === 0) {
      setPreviewResult(null);
      return;
    }

    if (!formula.trim()) {
      setPreviewResult(null);
      return;
    }

    const row1 = rows[0] || [];
    const result = evaluateFormulaOnRow(
      formula,
      headers,
      row1,
      angleMode,
      precision
    );
    setPreviewResult(result);
  }, [formula, angleMode, precision, headers, rows, isOpen]);

  if (!isOpen || !mounted) return null;

  const targetHeader = headers[targetColIdx] || `Column ${targetColIdx + 1}`;

  const insertToken = (token: string) => {
    if (!inputRef.current) {
      setFormula((prev) => prev + token);
      return;
    }
    const input = inputRef.current;
    const start = input.selectionStart ?? formula.length;
    const end = input.selectionEnd ?? formula.length;
    const nextFormula =
      formula.substring(0, start) + token + formula.substring(end);
    setFormula(nextFormula);

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + token.length, start + token.length);
    }, 10);
  };

  const handleApply = () => {
    if (!formula.trim()) return;

    // Compute for all rows
    const calculatedValues = rows.map((row) => {
      const res = evaluateFormulaOnRow(
        formula,
        headers,
        row,
        angleMode,
        precision
      );
      return res.success ? (res.formatted ?? "") : "ERR!";
    });

    onApplyFormula(formula, calculatedValues, precision);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in-50 duration-150 select-none">
      <div className="w-full max-w-xl bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/70 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-inner shrink-0">
              <Calculator className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                <span>Calculate Column {targetColIdx + 1}:</span>
                <span className="text-primary font-mono max-w-[280px] truncate inline-block">
                  <InlineMathText text={targetHeader} />
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">
                Auto-compute values row-by-row using scientific formulas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
            title="Close (Esc)"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[82vh] custom-scrollbar">
          {/* Formula Bar & Quick Operators */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Formula</label>
              <span className="text-[11px] text-muted-foreground font-normal">
                e.g. <code className="font-mono text-primary font-bold">col1 * col2</code> or <code className="font-mono text-primary font-bold">log10(col1)</code>
              </span>
            </div>

            <div className="relative flex items-center">
              <span className="absolute left-3.5 font-mono font-bold text-muted-foreground select-none text-sm">
                =
              </span>
              <input
                ref={inputRef}
                autoFocus
                type="text"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && previewResult?.success) {
                    e.preventDefault();
                    handleApply();
                  }
                }}
                placeholder="col1 * col2"
                className="w-full h-11 pl-8 pr-9 rounded-2xl bg-muted/40 border border-border/80 text-sm font-mono font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all shadow-inner"
              />
              {formula && (
                <button
                  type="button"
                  onClick={() => setFormula("")}
                  className="absolute right-3 p-1 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  title="Clear formula"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Quick Math Operators Strip */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
                Math:
              </span>
              {QUICK_OPERATORS.map((op) => (
                <button
                  key={op.label}
                  type="button"
                  onClick={() => insertToken(op.insert)}
                  title={op.title}
                  className="h-6 min-w-[26px] px-1.5 rounded-lg bg-muted/50 hover:bg-primary/10 hover:text-primary hover:border-primary/40 border border-border/70 text-xs font-mono font-bold text-foreground transition-all cursor-pointer active:scale-95 shadow-2xs"
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clickable Column Tokens */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Insert Column Reference
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {headers.map((h, i) => {
                const colLetter = String.fromCharCode(65 + (i % 26)); // A, B, C...
                const isTarget = i === targetColIdx;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isTarget}
                    onClick={() => insertToken(`col${i + 1}`)}
                    className={`h-7 px-2.5 rounded-xl border text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer max-w-[170px] ${
                      isTarget
                        ? "opacity-30 border-dashed cursor-not-allowed text-muted-foreground bg-muted/10"
                        : "bg-muted/40 border-border/80 hover:bg-primary/10 hover:border-primary/40 hover:text-primary active:scale-95 shadow-2xs"
                    }`}
                    title={isTarget ? "Cannot reference current column" : `Insert Column ${i + 1} (${h})`}
                  >
                    <span className="text-[10px] text-muted-foreground/70 font-semibold shrink-0">Col {colLetter}:</span>
                    <span className="truncate text-xs font-semibold">
                      <InlineMathText text={h || `Col ${i + 1}`} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1-Click Common Lab Presets (Balanced 4 x 2 Grid) */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="size-3 text-amber-500" />
              <span>Common Lab Presets (1-Click)</span>
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {LAB_FORMULA_PRESETS.map((preset) => {
                const defaultColA = targetColIdx > 0 ? `col1` : `col2`;
                const defaultColB = targetColIdx > 1 ? `col2` : `col1`;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setFormula(preset.template(defaultColA, defaultColB))}
                    className="p-2 rounded-xl bg-muted/25 hover:bg-muted/60 border border-border/60 text-left transition-all group active:scale-[0.98] cursor-pointer flex flex-col gap-0.5 shadow-2xs"
                    title={preset.description}
                  >
                    <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                      {preset.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate font-mono">
                      {preset.template("A", "B")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Configuration: Angle Mode & Decimal Precision (Segmented Controls) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-muted/25 border border-border/60">
            {/* Angle Mode Segmented Control */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-foreground">
                Trigonometry Angle
              </span>
              <div className="flex items-center p-0.5 bg-muted/60 rounded-xl border border-border/50 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setAngleMode("deg")}
                  className={`flex-1 py-1 rounded-lg transition-all text-center cursor-pointer ${
                    angleMode === "deg"
                      ? "bg-background text-foreground shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Degrees (°)
                </button>
                <button
                  type="button"
                  onClick={() => setAngleMode("rad")}
                  className={`flex-1 py-1 rounded-lg transition-all text-center cursor-pointer ${
                    angleMode === "rad"
                      ? "bg-background text-foreground shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Radians (rad)
                </button>
              </div>
            </div>

            {/* Precision Segmented Control (Replaces unstyled native <select>) */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-foreground">
                Decimal Precision
              </span>
              <div className="flex items-center p-0.5 bg-muted/60 rounded-xl border border-border/50 text-xs font-semibold">
                {PRECISION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPrecision(opt.id)}
                    className={`flex-1 py-1 rounded-lg transition-all text-center cursor-pointer ${
                      precision === opt.id
                        ? "bg-background text-foreground shadow-2xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Preview Box (Row 1) */}
          <div
            className={`p-3.5 rounded-2xl border transition-all flex items-start gap-2.5 ${
              !formula.trim()
                ? "bg-muted/20 border-border/60 text-muted-foreground"
                : previewResult?.success
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
            }`}
          >
            {previewResult?.success ? (
              <Check className="size-4 shrink-0 mt-0.5" />
            ) : previewResult?.error ? (
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
            ) : (
              <HelpCircle className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
            )}

            <div className="flex flex-col gap-0.5 text-xs flex-1 min-w-0">
              <span className="font-bold">
                {!formula.trim()
                  ? "Enter a formula above to see live calculation"
                  : previewResult?.success
                  ? "Formula Valid • Live Row 1 Evaluation"
                  : "Syntax or Evaluation Error"}
              </span>
              <div className="font-mono text-[11px] truncate">
                {previewResult?.success ? (
                  <>
                    Row 1 Result:{" "}
                    <span className="font-extrabold text-sm underline decoration-emerald-500/50">
                      {previewResult.formatted}
                    </span>
                  </>
                ) : previewResult?.error ? (
                  previewResult.error
                ) : (
                  "Supports: +, -, *, /, ^, log10, ln, sqrt, sin, cos, tan, pi, e, g"
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-border/70 bg-muted/20 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="rounded-xl cursor-pointer text-xs font-semibold hover:bg-muted"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={!previewResult?.success}
            onClick={handleApply}
            className="rounded-xl cursor-pointer text-xs font-semibold gap-1.5 disabled:opacity-40"
          >
            <Check className="size-3.5" />
            <span>Apply to All Rows ({rows.length})</span>
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
