"use client";

import React from "react";
import KatexRenderer from "./katex-renderer";

interface InlineMathTextProps {
  text: string;
  className?: string;
}

// Regex to detect bare LaTeX commands, Unicode math symbols, subscripts, superscripts, or formula patterns
const BARE_MATH_REGEX = /(\\[a-zA-Z]+|[ΔΩθμπαβγ°≤≥≠→↔±√₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓᵧ]|\b\d+\s*\/\s*\d+|\([^)]+\)\s*\/\s*\([^)]+\)|[a-zA-Z0-9]_\{?[a-zA-Z0-9]+\}?|\^[a-zA-Z0-9{}]|\b(cos|sin|tan|sec|csc|cot|log|ln|exp|sqrt)\b|[a-zA-Z0-9]+\s*=\s*[a-zA-Z0-9])/;

// Regex to match inline markdown formatting:
// 1. **bold**
// 2. ==highlight==
// 3. `inline code`
// 4. *italic* (non-greedy)
const MARKDOWN_REGEX = /(\*\*[^*]+\*\*|==[^=]+==|`[^`]+`|\*[^*]+?\*)/g;

/**
 * Parses markdown inline styles (bold, italic, code, highlight) and bare math.
 */
function parseTextFormatting(text: string, keyPrefix: string): React.ReactNode {
  if (!text) return null;

  const tokens = text.split(MARKDOWN_REGEX);
  if (tokens.length === 1) {
    if (BARE_MATH_REGEX.test(text)) {
      return (
        <span key={keyPrefix} className="inline-block px-0.5 align-baseline select-text">
          <KatexRenderer latex={text} displayMode={false} />
        </span>
      );
    }
    return text;
  }

  return tokens.map((token, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (!token) return null;

    // Bold: **text**
    if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
      const inner = token.slice(2, -2);
      return (
        <strong key={key} className="font-bold text-foreground">
          {parseTextFormatting(inner, `${key}-b`)}
        </strong>
      );
    }

    // Highlight: ==text==
    if (token.startsWith("==") && token.endsWith("==") && token.length >= 4) {
      const inner = token.slice(2, -2);
      return (
        <mark
          key={key}
          className="bg-amber-400/25 dark:bg-amber-400/20 text-foreground px-1 py-0.5 rounded font-medium border border-amber-500/20"
        >
          {parseTextFormatting(inner, `${key}-m`)}
        </mark>
      );
    }

    // Inline Code: `code`
    if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      const inner = token.slice(1, -1);
      return (
        <code
          key={key}
          className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-primary border border-border/50"
        >
          {inner}
        </code>
      );
    }

    // Italic: *text*
    if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) {
      const inner = token.slice(1, -1);
      return (
        <em key={key} className="italic text-foreground/90">
          {parseTextFormatting(inner, `${key}-i`)}
        </em>
      );
    }

    // Check for bare math
    if (BARE_MATH_REGEX.test(token)) {
      return (
        <span key={key} className="inline-block px-0.5 align-baseline select-text">
          <KatexRenderer latex={token} displayMode={false} />
        </span>
      );
    }

    return <React.Fragment key={key}>{token}</React.Fragment>;
  });
}

/**
 * Smart inline math and markdown text renderer:
 * 1. If text contains '$...$', splits and renders each '$...$' block with KaTeX,
 *    and formats the non-math text with markdown (bold, italic, code, highlight).
 * 2. If no '$...$', renders inline markdown tokens and bare math.
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
              <span key={`math-${idx}`} className="inline-block px-0.5 align-baseline select-text">
                <KatexRenderer latex={formula} displayMode={false} />
              </span>
            );
          }
          return (
            <React.Fragment key={`text-${idx}`}>
              {parseTextFormatting(token, `seg-${idx}`)}
            </React.Fragment>
          );
        })}
      </span>
    );
  }

  // Case 2: No explicit '$', parse markdown formatting and bare math
  return <span className={className}>{parseTextFormatting(text, "root")}</span>;
}

export default InlineMathText;
