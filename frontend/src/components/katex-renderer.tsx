"use client";

import React, { useMemo } from "react";
import katex from "katex";

interface KatexRendererProps {
  latex: string;
  displayMode?: boolean;
}

/**
 * Preprocesses raw user LaTeX / natural math string for KaTeX rendering:
 * 1. Formats multi-line equations into \begin{aligned} ... \end{aligned}
 * 2. Auto-anchors '=' with '&=' so all equals signs align vertically down the left side
 * 3. Compactly handles blank lines without creating massive vertical gaps
 * 4. Converts natural math shortcuts like (a)/(b) -> \frac{a}{b} if not already LaTeX
 * 5. Preserves consecutive spaces (e.g. "0.88  xy" -> "0.88 \ \ xy")
 */
export function formatLatexForKatex(input: string): string {
  if (!input) return "";
  let processed = input.trim();

  // Check if input has multiple lines (separated by \n or \\)
  const isMultiLine = processed.includes("\n") || processed.includes("\\\\");

  if (isMultiLine && !processed.includes("\\begin{")) {
    const rawLines = processed.split(/\n|\\\\/);
    const formattedLines: string[] = [];
    let consecutiveEmpties = 0;

    for (let line of rawLines) {
      let trimmed = line.trim();

      // Collapse multiple consecutive empty lines to 1
      if (!trimmed) {
        consecutiveEmpties++;
        if (consecutiveEmpties <= 1) {
          formattedLines.push("&");
        }
        continue;
      }

      consecutiveEmpties = 0;

      // Convert simple fraction shortcut e.g. (5+5+6)/(8+10) or 16/18 to \frac{...}{...}
      if (!trimmed.includes("\\frac") && trimmed.includes("/")) {
        trimmed = trimmed.replace(/\(([^)]+)\)\/\(([^)]+)\)/g, "\\frac{$1}{$2}");
        trimmed = trimmed.replace(/(\b[a-zA-Z0-9._+]+\b)\/(\b[a-zA-Z0-9._+]+\b)/g, "\\frac{$1}{$2}");
      }

      // Auto-anchor '=' for vertical alignment in KaTeX aligned environment
      if (trimmed.startsWith("=")) {
        trimmed = "&" + trimmed;
      } else if (trimmed.includes("=") && !trimmed.includes("&=")) {
        trimmed = trimmed.replace("=", " &=");
      } else if (!trimmed.startsWith("&")) {
        trimmed = "& " + trimmed;
      }

      // Preserve consecutive spaces inside line
      trimmed = trimmed.replace(/(?<!\\)( {2,})/g, (match) => " \\ ".repeat(match.length));

      formattedLines.push(trimmed);
    }

    processed = `\\begin{aligned}\n${formattedLines.join(" \\\\\n")}\n\\end{aligned}`;
  } else {
    // Single line mode fraction shortcut & space preservation
    if (!processed.includes("\\frac") && processed.includes("/")) {
      processed = processed.replace(/\(([^)]+)\)\/\(([^)]+)\)/g, "\\frac{$1}{$2}");
    }
    processed = processed.replace(/(?<!\\)( {2,})/g, (match) => " \\ ".repeat(match.length));
  }

  return processed;
}

export default function KatexRenderer({ latex, displayMode = false }: KatexRendererProps) {
  const formattedLatex = useMemo(() => formatLatexForKatex(latex), [latex]);

  const html = useMemo(() => {
    if (!formattedLatex) return "";
    try {
      return katex.renderToString(formattedLatex, {
        displayMode,
        throwOnError: false,
      });
    } catch (error) {
      console.error("Failed to render math:", error);
      return `<span class="text-destructive font-mono text-xs">Error parsing formula: ${latex}</span>`;
    }
  }, [formattedLatex, displayMode]);

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
