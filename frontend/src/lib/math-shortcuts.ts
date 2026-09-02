/**
 * Utility helper functions for math auto-completion and auto-replace shortcuts
 * inside text-based document blocks (Paragraph, Heading, Observation).
 */

const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", "/": "⁄", ",": "ˏ", ".": "·",
  "a": "ᵃ", "b": "ᵇ", "c": "ᶜ", "d": "ᵈ", "e": "ᵉ", "f": "ᶠ", "g": "ᵍ", "h": "ʰ", "i": "ⁱ", "j": "ʲ", "k": "ᵏ", "l": "ˡ", "m": "ᵐ", "n": "ⁿ", "o": "ᵒ", "p": "ᵖ", "r": "ʳ", "s": "ˢ", "t": "ᵗ", "u": "ᵘ", "v": "ᵛ", "w": "ʷ", "x": "ˣ", "y": "ʸ", "z": "ᶻ",
  "A": "ᴬ", "B": "ᴮ", "D": "ᴰ", "E": "ᴱ", "G": "ᴳ", "H": "ᴴ", "I": "ᴵ", "J": "ᴶ", "K": "ᴷ", "L": "ᴸ", "M": "ᴹ", "N": "ᴺ", "O": "ᴼ", "P": "ᴾ", "R": "ᴿ", "T": "ᵀ", "U": "ᵁ", "V": "ⱽ", "W": "ᵂ"
};

const SUBSCRIPTS: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", "/": "⁄", ",": "ˏ", ".": "·",
  "a": "ₐ", "e": "ₑ", "h": "ₕ", "i": "ᵢ", "j": "ⱼ", "k": "ₖ", "l": "ₗ", "m": "ₘ", "n": "ₙ", "o": "ₒ", "p": "ₚ", "r": "ᵣ", "s": "ₛ", "t": "ₜ", "u": "ᵤ", "v": "ᵥ", "x": "ₓ", "y": "ᵧ"
};

const REPLACEMENT_RULES = [
  { pattern: /sqrt\(([^)]*)\)/g, replacement: "√$1" },
  { pattern: /\balpha\b/g, replacement: "α" },
  { pattern: /\bbeta\b/g, replacement: "β" },
  { pattern: /\bgamma\b/g, replacement: "γ" },
  { pattern: /\btheta\b/g, replacement: "θ" },
  { pattern: /\bpi\b/g, replacement: "π" },
  { pattern: /\bmu\b/g, replacement: "μ" },
  { pattern: /\bsigma\b/g, replacement: "σ" },
  { pattern: /\blambda\b/g, replacement: "λ" },
  { pattern: /\bomega\b/g, replacement: "ω" },
  { pattern: /\bOmega\b/g, replacement: "Ω" },
  { pattern: /\bdelta\b/g, replacement: "δ" },
  { pattern: /\bDelta\b/g, replacement: "Δ" },
  { pattern: /\binfty\b/g, replacement: "∞" },
  { pattern: /<=/g, replacement: "≤" },
  { pattern: />=/g, replacement: "≥" },
  { pattern: /!=/g, replacement: "≠" },
  { pattern: /->/g, replacement: "→" },
  { pattern: /<->/g, replacement: "↔" },
  { pattern: /\+\/-/g, replacement: "±" },
];

function replaceBalancedGroupWithoutWrapping(text: string, prefix: string, mapDict: Record<string, string>): string {
  let result = "";
  let i = 0;
  while (i < text.length) {
    if (text.substring(i, i + prefix.length) === prefix) {
      let start = i + prefix.length;
      let depth = 1;
      let j = start;
      while (j < text.length && depth > 0) {
        if (text[j] === "(") depth++;
        else if (text[j] === ")") depth--;
        j++;
      }
      if (depth === 0) {
        const inner = text.substring(start, j - 1);
        const converted = inner.split("").map((c) => mapDict[c] || c).join("");
        result += converted;
        i = j;
        continue;
      }
    }
    result += text[i];
    i++;
  }
  return result;
}

function translateSuperscripts(text: string): string {
  // 1. Grouped with curly braces: ^{2x+22} -> ²ˣ⁺²²
  let result = text.replace(/\^\{([^}]+)\}/g, (_, group) => {
    return group.split("").map((c: string) => SUPERSCRIPTS[c] || c).join("");
  });

  // 2. Grouped with parentheses: ^(2x+22) -> ²ˣ⁺²²
  result = replaceBalancedGroupWithoutWrapping(result, "^(", SUPERSCRIPTS);

  // 3. Standalone un-grouped sequence of letters/digits/operators after ^: ^2x+22 -> ²ˣ⁺²²
  result = result.replace(/\^([0-9+\-=/a-zA-Z._]+)/g, (_, group) => {
    return group.split("").map((c: string) => SUPERSCRIPTS[c] || c).join("");
  });

  return result;
}

function translateSubscripts(text: string): string {
  // 1. Grouped with curly braces: _{i+1} -> ᵢ₊₁
  let result = text.replace(/_\{([^}]+)\}/g, (_, group) => {
    return group.split("").map((c: string) => SUBSCRIPTS[c] || c).join("");
  });

  // 2. Grouped with parentheses: _(i+1,j-1) -> ᵢ₊₁,ⱼ₋₁
  result = replaceBalancedGroupWithoutWrapping(result, "_(", SUBSCRIPTS);

  // 3. Standalone un-grouped sequence of letters/digits/operators after _: _i+1 -> ᵢ₊₁
  result = result.replace(/_([0-9+\-=/a-zA-Z._]+)/g, (_, group) => {
    return group.split("").map((c: string) => SUBSCRIPTS[c] || c).join("");
  });

  // 4. Extend active subscript sequence when typing contiguous letters directly following a Unicode subscript (e.g. Vᵢ + n -> Vᵢₙ)
  const UNICODE_SUBS = "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓᵧ";
  const subRegex = new RegExp(`([${UNICODE_SUBS}]+)([a-zA-Z0-9]+)`, "g");
  let prev = "";
  while (result !== prev) {
    prev = result;
    result = result.replace(subRegex, (_, subs, rest) => {
      const converted = rest.split("").map((c: string) => SUBSCRIPTS[c] || c).join("");
      return subs + converted;
    });
  }

  return result;
}

export function applyMathShortcuts(text: string): string {
  // If text contains LaTeX inline delimiters ($...$), don't corrupt the inside of $...$ with Unicode replacements
  const parts = text.split(/(\$[^$]+\$)/g);
  return parts
    .map((part) => {
      if (part.startsWith("$") && part.endsWith("$") && part.length > 1) {
        return part; // keep LaTeX untouched
      }
      let updated = part;
      for (const rule of REPLACEMENT_RULES) {
        updated = updated.replace(rule.pattern, rule.replacement);
      }
      updated = translateSuperscripts(updated);
      updated = translateSubscripts(updated);
      return updated;
    })
    .join("");
}
