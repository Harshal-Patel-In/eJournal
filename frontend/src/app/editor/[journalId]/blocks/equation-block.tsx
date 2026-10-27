"use client";

import React, { useRef, useState } from "react";
import { useDocumentStore } from "../use-document-store";
import KatexRenderer from "@/components/katex-renderer";
import { Sigma, Sparkles } from "lucide-react";

interface EquationBlockProps {
  id: string;
  content: {
    latex?: string;
  };
  previewMode: boolean;
}

const MATH_TEMPLATES = [
  { label: "Fraction", latex: "\\frac{a}{b}" },
  { label: "Root", latex: "\\sqrt{x}" },
  { label: "Power", latex: "x^{2}" },
  { label: "Subscript", latex: "x_{i}" },
  { label: "Integral", latex: "\\int_{a}^{b} x \\, dx" },
  { label: "Sum (Σ)", latex: "\\sum_{i=1}^{n} x_{i}" },
  { label: "Vector", latex: "\\vec{v}" },
  { label: "Limit", latex: "\\lim_{x \\to \\infty}" },
  { label: "Matrix (2x2)", latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
];

const GREEK_SYMBOLS = [
  { label: "α", latex: "\\alpha" },
  { label: "β", latex: "\\beta" },
  { label: "γ", latex: "\\gamma" },
  { label: "θ", latex: "\\theta" },
  { label: "π", latex: "\\pi" },
  { label: "μ", latex: "\\mu" },
  { label: "σ", latex: "\\sigma" },
  { label: "λ", latex: "\\lambda" },
  { label: "Ω", latex: "\\Omega" },
  { label: "Δ", latex: "\\Delta" },
  { label: "∞", latex: "\\infty" },
  { label: "±", latex: "\\pm" },
];

export default function EquationBlock({ id, content, previewMode }: EquationBlockProps) {
  const updateBlock = useDocumentStore((state) => state.updateBlock);
  const latex = content.latex ?? "";
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Start in edit mode only if block has no latex yet
  const [isFocused, setIsFocused] = useState<boolean>(() => !content.latex);

  const insertTemplate = (templateLatex: string) => {
    const input = textareaRef.current;
    if (!input) return;

    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const currentVal = input.value;
    const newVal = currentVal.substring(0, start) + templateLatex + currentVal.substring(end);

    updateBlock(id, { latex: newVal });

    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + templateLatex.length, start + templateLatex.length);
    });
  };

  // Auto-expand textarea height dynamically as content grows
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(80, textareaRef.current.scrollHeight)}px`;
    }
  }, [latex, isFocused]);

  // Focus textarea when entering edit mode
  React.useEffect(() => {
    if (isFocused && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isFocused]);

  // Read-only / Document Preview Mode
  if (previewMode) {
    if (!latex) {
      return (
        <div className="flex flex-col items-center justify-center p-6 border border-dashed border-border rounded-xl my-4 text-muted-foreground/60 italic text-xs select-none">
          Empty Equation
        </div>
      );
    }
    return (
      <div className="flex justify-center items-center py-6 w-full text-foreground select-text font-serif overflow-x-auto">
        <KatexRenderer latex={latex} displayMode={true} />
      </div>
    );
  }

  // 1. When NOT editing (blurred / user left block): Render clean KaTeX equation in-place directly on paper
  if (!isFocused) {
    if (!latex) {
      return (
        <div
          onClick={() => setIsFocused(true)}
          className="flex items-center justify-center p-4 border border-dashed border-border/80 rounded-xl cursor-pointer hover:bg-muted/10 transition-colors text-muted-foreground/60 text-xs gap-2 select-none my-2"
          title="Click to write equation"
        >
          <Sigma className="size-4" />
          <span>Click to write mathematical formula or multi-line steps...</span>
        </div>
      );
    }

    return (
      <div
        onClick={() => setIsFocused(true)}
        className="w-full flex justify-center items-center py-4 px-3 cursor-pointer rounded-xl hover:bg-muted/15 transition-all text-foreground select-text font-serif overflow-x-auto min-h-[50px] group/eq my-1"
        title="Click to edit formula"
      >
        <KatexRenderer latex={latex} displayMode={true} />
      </div>
    );
  }

  // 2. When EDITING (user clicked into block): Show math toolbar, auto-resizing input, and live rendered output
  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-3 w-full border border-border p-4 rounded-xl bg-card shadow-sm transition-all focus-within:ring-1 focus-within:ring-primary/40 my-2"
    >
      {/* Block Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2 select-none">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Sigma className="size-3.5 text-primary" /> Equation Editor
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">
            LaTeX & Multi-line
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsFocused(false)}
          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors cursor-pointer"
        >
          Done
        </button>
      </div>

      {/* Scientific Math Toolbar */}
      <div className="flex flex-col gap-2 select-none border-b border-border/40 pb-2.5">
        {/* Greek / Scientific Symbols */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] font-bold text-muted-foreground mr-1 uppercase">Symbols:</span>
          {GREEK_SYMBOLS.map((symbol) => (
            <button
              key={symbol.latex}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertTemplate(symbol.latex);
              }}
              className="px-2 py-0.5 rounded text-xs font-medium hover:bg-muted active:scale-95 text-foreground border border-border/50 transition-all cursor-pointer bg-background"
              title={symbol.latex}
            >
              {symbol.label}
            </button>
          ))}
        </div>

        {/* Math Templates */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] font-bold text-muted-foreground mr-1 uppercase">Templates:</span>
          {MATH_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.latex}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertTemplate(tmpl.latex);
              }}
              className="px-2 py-0.5 rounded text-[11px] font-semibold hover:bg-primary/10 hover:text-primary active:scale-95 text-muted-foreground border border-border/50 transition-all cursor-pointer bg-background"
            >
              {tmpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* Editor & Live Rendered Output */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Auto-resizing multi-line LaTeX input */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-muted-foreground uppercase select-none">
              Formula Input (Enter for new line)
            </label>
            <span className="text-[10px] text-muted-foreground/60">Esc to finish</span>
          </div>
          <textarea
            ref={textareaRef}
            rows={3}
            value={latex}
            onChange={(e) => updateBlock(id, { latex: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setIsFocused(false);
              }
            }}
            onBlur={(e) => {
              if (containerRef.current && containerRef.current.contains(e.relatedTarget as Node)) {
                return;
              }
              setTimeout(() => {
                if (latex) setIsFocused(false);
              }, 150);
            }}
            placeholder={"e.g.\n=\\frac{5+5+6}{8+10}\n=\\frac{16}{18}\n=0.88"}
            className="w-full min-h-[90px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary font-mono resize-none leading-relaxed"
          />
        </div>

        {/* Live KaTeX Render Canvas */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase select-none flex items-center gap-1">
            <Sparkles className="size-3 text-primary" /> Preview Output
          </span>
          <div className="flex items-center justify-center min-h-[90px] px-4 py-3 rounded-lg border border-border bg-muted/20 text-center font-serif select-text overflow-x-auto custom-scrollbar">
            {latex ? (
              <div className="w-full flex justify-center min-w-max">
                <KatexRenderer latex={latex} displayMode={true} />
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/60 italic font-sans select-none">
                Equation preview will appear here...
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
