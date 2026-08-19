"use client";

import React from "react";
import KatexRenderer from "./katex-renderer";

interface InlineMathTextProps {
  text: string;
  className?: string;
}

/**
 * Parses and renders mixed text containing inline LaTeX formulas delimited by $...$
 * alongside formatted Unicode text.
 * Example:
 * "The frequency is $f_r = \frac{1}{2\pi\sqrt{LC}}$ in Hz."
 * -> Renders "The frequency is " + [Rendered KaTeX] + " in Hz."
 */
export function InlineMathText({ text, className = "" }: InlineMathTextProps) {
  if (!text) return null;

  // Split on inline $...$ patterns
  const tokens = text.split(/(\$[^$]+\$)/g);

  return (
    <span className={className}>
      {tokens.map((token, idx) => {
        if (token.startsWith("$") && token.endsWith("$") && token.length > 2) {
          const formula = token.slice(1, -1);
          return (
            <span key={idx} className="inline-block px-1 align-baseline select-text">
              <KatexRenderer latex={formula} displayMode={false} />
            </span>
          );
        }
        return <React.Fragment key={idx}>{token}</React.Fragment>;
      })}
    </span>
  );
}

export default InlineMathText;
