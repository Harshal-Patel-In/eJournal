"use client";

import React, { useMemo } from "react";
import katex from "katex";

interface KatexRendererProps {
  latex: string;
  displayMode?: boolean;
}

/**
 * Natural Math Auto-Compiler:
 * Translates 100% natural student plain math into textbook-quality KaTeX typography.
 * - Auto-aligns multi-line derivations along '=' (Column 1 = variable, Column 2 = &= expression)
 * - 1:1 Natural Spacing Engine (every space typed is visible)
 * - Auto-scales parentheses \left( ... \right) around fractions
 * - Auto-converts Greek words (omega -> \omega, pi -> \pi, theta -> \theta)
 * - Protects physical units (15 m/s, 9.8 m/s^2, 4.098 V, 30 deg, 100 kHz)
 * - Auto-groups subscripts (V_out -> V_{out}, R_1 -> R_{1})
 */
export function formatLatexForKatex(input: string): string {
  if (!input) return "";
  let processed = input.trim();

  // If user already wrote a full LaTeX environment like \begin{matrix}, respect it
  if (processed.includes("\\begin{")) {
    return processed;
  }

  // 1. Greek letter shortcut conversion (e.g. "omega" -> "\omega", "mu" -> "\mu", "pi" -> "\pi")
  const GREEK_WORDS = [
    "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta",
    "iota", "kappa", "lambda", "mu", "nu", "xi", "pi", "rho", "sigma",
    "tau", "upsilon", "phi", "chi", "psi", "omega", "Gamma", "Delta",
    "Theta", "Lambda", "Xi", "Pi", "Sigma", "Phi", "Psi", "Omega"
  ];
  for (const g of GREEK_WORDS) {
    const greekRegex = new RegExp(`(^|[^a-zA-Z\\\\])(${g})(?=[^a-zA-Z]|$)`, "g");
    processed = processed.replace(greekRegex, `$1\\${g}`);
  }

  // 2. Math functions & comparison shortcuts
  processed = processed.replace(/sqrt\(([^()]+)\)/g, "\\sqrt{$1}");
  processed = processed.replace(/<=\s*/g, "\\le ");
  processed = processed.replace(/>=\s*/g, "\\ge ");
  processed = processed.replace(/->\s*/g, "\\to ");
  processed = processed.replace(/!=\s*/g, "\\neq ");
  processed = processed.replace(/\s*\*\s*/g, " \\cdot ");

  // 3. Shield Text & Physical Units
  const textBlocks: string[] = [];
  function saveTextBlock(content: string): string {
    textBlocks.push(content);
    return `__TXTB_${textBlocks.length - 1}__`;
  }

  // Multi-character and standard units (only after numbers, or multi-char like m/s, deg, kHz)
  const UNIT_PATTERN = /(\d+(?:\.\d+)?)\s*(m\/s\^2|m\/s|km\/h|rad\/s|cm\^2|mm\^2|m\^2|cm\^3|mm\^3|m\^3|kHz|MHz|GHz|THz|Hz|mV|kV|MV|V|mA|uA|kA|A|mW|kW|MW|GW|W|mJ|kJ|MJ|J|kPa|MPa|GPa|Pa|bar|pF|nF|uF|µF|mF|F|uH|µH|mH|H|k\\Omega|M\\Omega|\\Omega|ohm|ohms|deg|rad|sec|min|hrs|hr|s|ms|us|µs|ns|kg|mg|ug|µg|g|K|cal|kcal|dB|rpm)\b/g;
  processed = processed.replace(UNIT_PATTERN, (_, num, unit) => {
    const cleanNum = num ? `${num}\\ ` : "";
    if (unit.includes("^")) {
      const [baseUnit, exp] = unit.split("^");
      return saveTextBlock(`${cleanNum}\\text{${baseUnit}}^{${exp}}`);
    }
    return saveTextBlock(`${cleanNum}\\text{${unit}}`);
  });

  // Connective English words
  const CONNECTIVE_WORDS = [
    "where", "and", "when", "for", "if", "at", "let", "given", "with", "since", "then", "therefore", "thus"
  ];
  for (const word of CONNECTIVE_WORDS) {
    const wordRegex = new RegExp(`(^|\\s)(${word})(\\s|$)`, "gi");
    processed = processed.replace(wordRegex, (m, p1, w, p2) => {
      return `${p1}` + saveTextBlock(`\\text{${w}}`) + `${p2}`;
    });
  }

  // 4. Helper function to format an individual mathematical expression
  function formatExpression(str: string): string {
    let s = str;

    // A. Recursive balanced fraction parser
    let prev = "";
    let iter = 0;
    while (s !== prev && iter < 10) {
      prev = s;
      iter++;
      s = s.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, "\\frac{$1}{$2}");
      s = s.replace(/\(([^()]+)\)\s*\/\s*([a-zA-Z0-9._]+|__TXTB_\d+__|\\sqrt\{[^}]+\}|\\?[a-zA-Z]+)/g, "\\frac{$1}{$2}");
      s = s.replace(/([a-zA-Z0-9._]+|__TXTB_\d+__|\\sqrt\{[^}]+\}|\\?[a-zA-Z]+)\s*\/\s*\(([^()]+)\)/g, "\\frac{$1}{$2}");
      s = s.replace(/(^|[^a-zA-Z0-9._\\])([a-zA-Z0-9._]+|\\sqrt\{[^}]+\}|\\?[a-zA-Z]+)\s*\/\s*([a-zA-Z0-9._]+|\\sqrt\{[^}]+\}|\\?[a-zA-Z]+)($|[^a-zA-Z0-9._])/g, "$1\\frac{$2}{$3}$4");
    }

    // B. Auto-scaling parentheses: ( \frac{...}{...} ) -> \left( \frac{...}{...} \right)
    s = s.replace(/\(\s*(\\frac\{[^{}]*\}\{[^{}]*\})\s*\)/g, "\\left( $1 \\right)");

    // C. Subscript grouping: V_out -> V_{out}
    s = s.replace(/([a-zA-Z0-9\\]+)_([a-zA-Z0-9]+)/g, (m, base, sub) => {
      if (base.endsWith("}") || base.includes("TXTB")) return m;
      return `${base}_{${sub}}`;
    });

    // D. 1:1 Natural Spacing
    s = s.replace(/ +/g, (spaces) => Array(spaces.length).fill("\\ ").join(""));

    return s;
  }

  // 5. Multi-line derivation splitting & alignment
  const isMultiLine = processed.includes("\n") || processed.includes("\\\\");
  const rawLines = isMultiLine ? processed.split(/\n|\\\\/) : [processed];
  const formattedLines: string[] = [];
  let hasEqualsAlignment = false;

  for (let rawLine of rawLines) {
    const rawTrimmed = rawLine.trim();
    if (!rawTrimmed) continue;

    if (isMultiLine) {
      if (rawTrimmed.startsWith("=")) {
        // Line starts with '=' (e.g. "= (10 / 12.2) * 5")
        hasEqualsAlignment = true;
        const rightPart = rawTrimmed.substring(1).trim();
        formattedLines.push(`&= ${formatExpression(rightPart)}`);
      } else if (rawTrimmed.includes("=") && !rawTrimmed.includes("\\le") && !rawTrimmed.includes("\\ge") && !rawTrimmed.includes("\\neq")) {
        // Line has variable and '=' (e.g. "V_out = (R_2 / (R_1 + R_2)) * V_in")
        hasEqualsAlignment = true;
        const equalsIdx = rawTrimmed.indexOf("=");
        const leftPart = rawTrimmed.substring(0, equalsIdx).trim();
        const rightPart = rawTrimmed.substring(equalsIdx + 1).trim();
        formattedLines.push(`${formatExpression(leftPart)} &= ${formatExpression(rightPart)}`);
      } else {
        formattedLines.push(formatExpression(rawLine));
      }
    } else {
      formattedLines.push(formatExpression(rawLine));
    }
  }

  let finalLatex = "";
  if (isMultiLine) {
    if (hasEqualsAlignment) {
      finalLatex = `\\begin{aligned}\n${formattedLines.join(" \\\\\n")}\n\\end{aligned}`;
    } else {
      finalLatex = `\\begin{gathered}\n${formattedLines.join(" \\\\\n")}\n\\end{gathered}`;
    }
  } else {
    finalLatex = formattedLines[0] || "";
  }

  // Restore protected text blocks
  for (let i = 0; i < textBlocks.length; i++) {
    finalLatex = finalLatex.split(`__TXTB_${i}__`).join(textBlocks[i]);
  }

  return finalLatex;
}

export default function KatexRenderer({ latex, displayMode = false }: KatexRendererProps) {
  const formattedLatex = useMemo(() => formatLatexForKatex(latex), [latex]);

  const html = useMemo(() => {
    if (!formattedLatex) return "";
    try {
      return katex.renderToString(formattedLatex, {
        displayMode,
        throwOnError: false,
        strict: "ignore",
      });
    } catch (error) {
      console.error("Failed to render math:", error);
      return `<span class="text-destructive font-mono text-xs">Error parsing formula: ${latex}</span>`;
    }
  }, [formattedLatex, displayMode]);

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
