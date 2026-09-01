"use client";

import React from "react";
import KatexRenderer from "./katex-renderer";

interface InlineMathTextProps {
  text: string;
  className?: string;
}

// Regex to detect bare LaTeX commands, Unicode math symbols, subscripts, superscripts, or formula patterns
const BARE_MATH_REGEX = /(\\[a-zA-Z]+|[ΔΩθμπαβγ°≤≥≠→↔±√₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓᵧ]|\b\d+\s*\/\s*\d+|\([^)]+\)\s*\/\s*\([^)]+\)|[a-zA-Z0-9]_\{?[a-zA-Z0-9]+\}?|\^[a-zA-Z0-9{}]|\b(cos|sin|tan|sec|csc|cot|log|ln|exp|sqrt)\b|[a-zA-Z0-9]+\s*=\s*[a-zA-Z0-9])/;

/**
 * Smart inline math renderer:
 * 1. If text contains '$...$', splits and renders each '$...$' block with KaTeX.
 * 2. If text contains bare LaTeX commands or Unicode mathematical symbols,
 *    renders the entire formula directly with KaTeX.
 * 3. Otherwise, renders as clean plain text.
 */
export function InlineMathText({ text, className = "" }: InlineMathTextProps) {
  if (!text) return null;

  // Case 1: Explicit '$...$' delimiters
  if (text.includes("$")) {
    const tokens = text.split(/(\$[^$]+\$)/g);
    return (
      <span className={className}>
        {tokens.map((token, idx) => {
          if (token.startsWith("$") && token.endsWith("$") && token.length > 2) {
            const formula = token.slice(1, -1);
            return (
              <span key={idx} className="inline-block px-0.5 align-baseline select-text">
                <KatexRenderer latex={formula} displayMode={false} />
              </span>
            );
          }
          return <React.Fragment key={idx}>{token}</React.Fragment>;
        })}
      </span>
    );
  }

  // Case 2: Bare LaTeX commands or mathematical formulas (e.g., in table headers or cells)
  if (BARE_MATH_REGEX.test(text)) {
    return (
      <span className={`inline-block px-0.5 align-baseline select-text ${className}`}>
        <KatexRenderer latex={text} displayMode={false} />
      </span>
    );
  }

  // Case 3: Plain text
  return <span className={className}>{text}</span>;
}

export default InlineMathText;
