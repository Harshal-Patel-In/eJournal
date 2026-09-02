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
 * - Auto-converts Greek words (omega -> \omega, pi -> \pi, theta -> \theta, Omega -> \Omega, Delta -> \Delta)
 * - Normalizes Unicode Greek & Subscripts (Δ -> \Delta, Ω -> \Omega, Vᵢₙ -> V_{in})
 * - Protects physical units (15 m/s, 9.8 m/s^2, 4.098 V, 30 deg, 100 kHz, (mA), (mW), (\Omega))
 * - Auto-groups subscripts (V_out -> V_{out}, R_1 -> R_{1}, R_eq -> R_{eq})
 * - Trigonometric & math functions (cos(\theta), sin(\omega t), sqrt(...))
 * - Normalizes temperature degree notations ((^\circ C) -> (^{\circ}\text{C}))
 */
export function formatLatexForKatex(input: string): string {
  if (!input) return "";
  let processed = input.trim();

  // If user already wrote a full LaTeX environment like \begin{matrix}, respect it
  if (processed.includes("\\begin{")) {
    return processed;
  }

  // 0a. Clean corrupted backslashes before Unicode chars (e.g. "\Δ" -> "\Delta", "\Ω" -> "\Omega", "\θ" -> "\theta")
  processed = processed.replace(/\\Δ/g, "\\Delta ");
  processed = processed.replace(/\\Ω/g, "\\Omega ");
  processed = processed.replace(/\\θ/g, "\\theta ");
  processed = processed.replace(/\\μ/g, "\\mu ");
  processed = processed.replace(/\\π/g, "\\pi ");
  processed = processed.replace(/\\α/g, "\\alpha ");
  processed = processed.replace(/\\β/g, "\\beta ");
  processed = processed.replace(/\\γ/g, "\\gamma ");

  // 0b. Convert standalone Unicode Greek & math characters to LaTeX
  processed = processed.replace(/Δ/g, "\\Delta ");
  processed = processed.replace(/Ω/g, "\\Omega ");
  processed = processed.replace(/θ/g, "\\theta ");
  processed = processed.replace(/μ/g, "\\mu ");
  processed = processed.replace(/π/g, "\\pi ");
  processed = processed.replace(/α/g, "\\alpha ");
  processed = processed.replace(/β/g, "\\beta ");
  processed = processed.replace(/γ/g, "\\gamma ");
  processed = processed.replace(/°C|^\circ\s*C/g, "^{\\circ}\\text{C}");
  processed = processed.replace(/°|^\circ/g, "^{\\circ}");

  // 0c. Normalize Unicode subscripts back to LaTeX (e.g. Vᵢₙ -> V_{in}, Vᵢn -> V_{in}, Rₑq -> R_{eq})
  const UNICODE_SUB_MAP: Record<string, string> = {
    "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
    "₊": "+", "₋": "-", "₌": "=", "₍": "(", "₎": ")",
    "ₐ": "a", "ₑ": "e", "ₕ": "h", "ᵢ": "i", "ⱼ": "j", "ₖ": "k", "ₗ": "l", "ₘ": "m", "ₙ": "n", "ₒ": "o", "ₚ": "p", "ᵣ": "r", "ₛ": "s", "ₜ": "t", "ᵤ": "u", "ᵥ": "v", "ₓ": "x", "ᵧ": "y"
  };
  processed = processed.replace(/([a-zA-Z0-9\\]+)([₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓᵧ]+)([a-zA-Z0-9]*)/g, (_, base, subs, rest) => {
    const converted = subs.split("").map((c: string) => UNICODE_SUB_MAP[c] || c).join("");
    return `${base}_{${converted}${rest || ""}}`;
  });

  // 0d. Escape standalone '#' to '\#'
  processed = processed.replace(/#/g, "\\#");

  // 0e. Pre-normalize degree notations (e.g. "(^\circ C)", "^\circ C", "deg C")
  processed = processed.replace(/\(\s*\^\\circ\s*C\s*\)/gi, "(^{\\circ}\\text{C})");
  processed = processed.replace(/\^\\circ\s*C\b/gi, "^{\\circ}\\text{C}");

  // 1. Greek letter shortcut conversion
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

  // 2. Trigonometric & mathematical functions (e.g. cos(\theta), sin(\omega t))
  const MATH_FUNCS = ["cos", "sin", "tan", "sec", "csc", "cot", "arccos", "arcsin", "arctan", "exp", "ln", "log"];
  for (const fn of MATH_FUNCS) {
    const fnRegex = new RegExp(`(^|[^a-zA-Z\\\\])(${fn})(?=\\s*\\(|\\s*[a-zA-Z0-9])`, "g");
    processed = processed.replace(fnRegex, `$1\\${fn}`);
  }

  // 3. Math shortcuts
  processed = processed.replace(/sqrt\(([^()]+)\)/g, "\\sqrt{$1}");
  processed = processed.replace(/<=\s*/g, "\\le ");
  processed = processed.replace(/>=\s*/g, "\\ge ");
  processed = processed.replace(/->\s*/g, "\\to ");
  processed = processed.replace(/!=\s*/g, "\\neq ");
  processed = processed.replace(/\s*\*\s*/g, " \\cdot ");

  // 4. Shield Physical Units ONLY (never math symbols like \theta or \phi)
  const textBlocks: string[] = [];
  function saveTextBlock(content: string): string {
    textBlocks.push(content);
    return `__TXTB_${textBlocks.length - 1}__`;
  }

  // Units in parentheses (e.g. "(V)", "(mA)", "(mW)", "(Hz)", "(deg)", "(s)")
  const KNOWN_UNITS_IN_PARENS = /^\s*(\bV\b|\bmV\b|\bkV\b|\bA\b|\bmA\b|\buA\b|\bW\b|\bmW\b|\bkW\b|\bHz\b|\bkHz\b|\bMHz\b|\bJ\b|\bkJ\b|\bN\b|\bPa\b|\bkPa\b|\bMPa\b|\bF\b|\buF\b|\bnF\b|\bpF\b|\bH\b|\bmH\b|\buH\b|\bs\b|\bms\b|\bus\b|\bns\b|\bkg\b|\bg\b|\bmg\b|\bm\b|\bcm\b|\bmm\b|\bdeg\b|\brad\b|\bohm\b|\bohms\b|m\/s\^2|m\/s|km\/h|rad\/s)\s*$/;
  processed = processed.replace(/\(\s*([a-zA-Z0-9^/]+)\s*\)/g, (m, u) => {
    if (KNOWN_UNITS_IN_PARENS.test(u)) {
      return saveTextBlock(`\\text{(${u})}`);
    }
    return m;
  });

  // Multi-character and standard units (after numbers)
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

  // 5. Helper function to format an individual mathematical expression
  function formatExpression(str: string): string {
    let s = str;

    // A. Subscript grouping: V_out -> V_{out}, R_eq -> R_{eq} FIRST
    s = s.replace(/([a-zA-Z0-9\\]+)_([a-zA-Z0-9]+)/g, (m, base, sub) => {
      if (base.endsWith("}") || base.includes("TXTB") || base.startsWith("\\text")) return m;
      return `${base}_{${sub}}`;
    });

    // B. Recursive balanced fraction parser (bracket- and Greek-aware)
    const GREEK_PREFIX = "(?:\\\\(?:Delta|delta|partial|nabla)\\s+)?";
    const TERM =
      "(?:__TXTB_\\d+__|\\\\sqrt\\{[^}]+\\}|" +
      GREEK_PREFIX +
      "[a-zA-Z0-9]+(?:\\{[^}]*\\}|\\^[a-zA-Z0-9]+|_\\{[^}]*\\}|_[a-zA-Z0-9]+)*|\\\\[a-zA-Z]+(?:\\{[^}]*\\})*)";

    let prev = "";
    let iter = 0;
    while (s !== prev && iter < 10) {
      prev = s;
      iter++;
      // (A) / (B)
      s = s.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, "\\frac{$1}{$2}");
      // (A) / B
      s = s.replace(new RegExp('\\(([^()]+)\\)\\s*\\/\\s*(' + TERM + ')', 'g'), "\\frac{$1}{$2}");
      // A / (B)
      s = s.replace(new RegExp('(' + TERM + ')\\s*\\/\\s*\\(([^()]+)\\)', 'g'), "\\frac{$1}{$2}");
      // A / B
      s = s.replace(new RegExp('(^|[^a-zA-Z0-9_\\\\}])(' + TERM + ')\\s*\\/\\s*(' + TERM + ')(?=[^a-zA-Z0-9_\\\\{]|$)', 'g'), "$1\\frac{$2}{$3}");
    }

    // C. Auto-scaling parentheses: ( \frac{...}{...} ) -> \left( \frac{...}{...} \right)
    s = s.replace(/\(\s*(\\frac\{[^{}]*\}\{[^{}]*\})\s*\)/g, "\\left( $1 \\right)");

    // D. 1:1 Natural Spacing
    s = s.replace(/ +/g, (spaces) => Array(spaces.length).fill("\\ ").join(""));

    return s;
  }

  // 6. Line processing and auto-alignment
  const isMultiLine = processed.includes("\n") || processed.includes("\\\\");
  const rawLines = isMultiLine ? processed.split(/\n|\\\\/) : [processed];
  const formattedLines = [];
  let hasEqualsAlignment = false;

  for (let rawLine of rawLines) {
    const rawTrimmed = rawLine.trim();
    if (!rawTrimmed) continue;

    if (isMultiLine) {
      if (rawTrimmed.startsWith("=")) {
        hasEqualsAlignment = true;
        const rightPart = rawTrimmed.substring(1).trim();
        formattedLines.push(`&= ${formatExpression(rightPart)}`);
      } else if (rawTrimmed.includes("=") && !rawTrimmed.includes("\\le") && !rawTrimmed.includes("\\ge") && !rawTrimmed.includes("\\neq")) {
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
