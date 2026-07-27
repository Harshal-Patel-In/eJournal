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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const insertTemplate = (templateLatex: string) => {
    const input = textareaRef.current;
    if (!input) return;

    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const currentVal = input.value;
    const newVal = currentVal.substring(0, start) + templateLatex + currentVal.substring(end);

    updateBlock(id, { latex: newVal });

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + templateLatex.length, start + templateLatex.length);
    }, 50);
  };

  // Auto-expand textarea height dynamically as content grows
  React.useLayoutEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(120, textareaRef.current.scrollHeight)}px`;
    }
  }, [latex]);

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

  return (
    <div className="flex flex-col gap-3 w-full border border-border p-4 rounded-xl bg-card shadow-sm transition-all focus-within:ring-1 focus-within:ring-primary/40">
      {/* Block Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-1.5 mb-0.5 select-none">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Sigma className="size-3.5" /> Equation Block
        </span>
        <span className="text-[10px] text-muted-foreground/80 font-medium">LaTeX & Multi-line Calculation Mode</span>
      </div>

      {/* Scientific Math Toolbar */}
      {(isFocused || latex) && (
        <div className="flex flex-col gap-2 select-none border-b border-border/40 pb-2">
          {/* Greek / Scientific Symbols */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-bold text-muted-foreground mr-1.5 uppercase">Symbols:</span>
            {GREEK_SYMBOLS.map((symbol) => (
              <button
                key={symbol.latex}
                type="button"
                onClick={() => insertTemplate(symbol.latex)}
                className="px-2 py-0.5 rounded text-xs font-medium hover:bg-muted text-foreground border border-border/50 transition-colors cursor-pointer bg-background"
                title={symbol.latex}
              >
                {symbol.label}
              </button>
            ))}
          </div>

          {/* Form Templates */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-bold text-muted-foreground mr-1.5 uppercase">Templates:</span>
            {MATH_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.latex}
                type="button"
                onClick={() => insertTemplate(tmpl.latex)}
                className="px-2 py-0.5 rounded text-[11px] font-semibold hover:bg-primary/10 hover:text-primary text-muted-foreground border border-border/50 transition-colors cursor-pointer bg-background"
              >
                {tmpl.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editor & Live Preview Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Editor multi-line input */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-muted-foreground uppercase select-none">
              LaTeX Notation / Multi-line Steps
            </label>
            <span className="text-[10px] text-muted-foreground/60">Press Enter for new line</span>
          </div>
          <textarea
            ref={textareaRef}
            value={latex}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            onChange={(e) => updateBlock(id, { latex: e.target.value })}
            placeholder={"e.g.\n=\\frac{5+5+6}{8+10}\n=\\frac{16}{18}\n=0.88"}
            className="w-full min-h-[120px] max-h-[500px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary font-mono custom-scrollbar resize-y"
          />
        </div>

        {/* KaTeX Live Render Canvas (Anchored to Top) */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase select-none flex items-center gap-1">
            <Sparkles className="size-3 text-primary" /> Live Math Preview
          </span>
          <div className="flex items-start justify-center min-h-[120px] max-h-[500px] px-4 py-3 rounded-md border border-border bg-muted/20 text-center font-serif select-all overflow-auto custom-scrollbar">
            {latex ? (
              <KatexRenderer latex={latex} displayMode={true} />
            ) : (
              <span className="text-xs text-muted-foreground/60 italic font-sans select-none self-center">
                Preview mathematical output...
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
