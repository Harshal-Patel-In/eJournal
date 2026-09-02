/**
 * Table Column Scientific Formula Evaluation Engine.
 *
 * Safe, dependency-free recursive-descent parser for academic laboratory data.
 * Supports:
 * - Arithmetic: +, -, *, /, ^ (powers), ()
 * - Functions: log10, log, ln, log2, sqrt, cbrt, sin, cos, tan, asin, acos, atan, abs, exp, round
 * - Constants: pi, e, g (9.80665), c (299792458)
 * - Column identifiers: col1, col2, colA, colB, A, B, or [Column Name]
 * - Angular modes: Degrees or Radians for trigonometric operations
 * - Precision formatting: Auto, 0-5 decimal places, scientific notation
 */

export interface FormulaContext {
  headers: string[];
  row: string[];
  angleMode?: "deg" | "rad";
}

export interface FormulaResult {
  success: boolean;
  value?: number;
  formatted?: string;
  error?: string;
}

/**
 * Token types for formula lexical analysis.
 */
type TokenType =
  | "NUMBER"
  | "IDENTIFIER"
  | "OPERATOR"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "EOF";

interface Token {
  type: TokenType;
  value: string;
}

/**
 * Tokenize a formula string.
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  // Strip leading '=' if present
  let cleanInput = input.trim();
  if (cleanInput.startsWith("=")) {
    cleanInput = cleanInput.slice(1).trim();
  }

  while (i < cleanInput.length) {
    const char = cleanInput[i];

    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Number (including floats)
    if (/[0-9]/.test(char) || (char === "." && i + 1 < cleanInput.length && /[0-9]/.test(cleanInput[i + 1]))) {
      let numStr = "";
      while (i < cleanInput.length && (/[0-9]/.test(cleanInput[i]) || cleanInput[i] === ".")) {
        numStr += cleanInput[i];
        i++;
      }
      tokens.push({ type: "NUMBER", value: numStr });
      continue;
    }

    // Column bracket reference: [Column Name]
    if (char === "[") {
      i++;
      let bracketName = "";
      while (i < cleanInput.length && cleanInput[i] !== "]") {
        bracketName += cleanInput[i];
        i++;
      }
      if (cleanInput[i] === "]") i++;
      tokens.push({ type: "IDENTIFIER", value: `[${bracketName.trim()}]` });
      continue;
    }

    // Identifiers (function names, column names like col1, A, B, pi)
    if (/[a-zA-Z_]/.test(char)) {
      let idStr = "";
      while (i < cleanInput.length && /[a-zA-Z0-9_]/.test(cleanInput[i])) {
        idStr += cleanInput[i];
        i++;
      }
      tokens.push({ type: "IDENTIFIER", value: idStr });
      continue;
    }

    // Operators
    if (["+", "-", "*", "/", "^", "%"].includes(char)) {
      tokens.push({ type: "OPERATOR", value: char });
      i++;
      continue;
    }

    // Parentheses & comma
    if (char === "(") {
      tokens.push({ type: "LPAREN", value: "(" });
      i++;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "RPAREN", value: ")" });
      i++;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "COMMA", value: "," });
      i++;
      continue;
    }

    // Unknown character, skip
    i++;
  }

  tokens.push({ type: "EOF", value: "" });
  return tokens;
}

/**
 * Resolve a column reference into its numeric value for the current row.
 */
function resolveColumnValue(ref: string, ctx: FormulaContext): number {
  const lowerRef = ref.toLowerCase().trim();

  // Pattern 1: [Exact Column Title]
  if (ref.startsWith("[") && ref.endsWith("]")) {
    const colName = ref.slice(1, -1).trim();
    const idx = ctx.headers.findIndex(
      (h) => h.trim().toLowerCase() === colName.toLowerCase()
    );
    if (idx !== -1 && idx < ctx.row.length) {
      const parsed = parseFloat(ctx.row[idx]);
      if (!isNaN(parsed)) return parsed;
    }
  }

  // Pattern 2: col1, col2, col_1, col_2 (1-indexed)
  const colIndexMatch = lowerRef.match(/^col_?(\d+)$/);
  if (colIndexMatch) {
    const idx = parseInt(colIndexMatch[1], 10) - 1;
    if (idx >= 0 && idx < ctx.row.length) {
      const parsed = parseFloat(ctx.row[idx]);
      if (!isNaN(parsed)) return parsed;
    }
  }

  // Pattern 3: colA, colB, colC (Letter references)
  const colLetterMatch = lowerRef.match(/^col_?([a-z])$/);
  if (colLetterMatch) {
    const idx = colLetterMatch[1].charCodeAt(0) - 97; // 'a' -> 0, 'b' -> 1
    if (idx >= 0 && idx < ctx.row.length) {
      const parsed = parseFloat(ctx.row[idx]);
      if (!isNaN(parsed)) return parsed;
    }
  }

  // Pattern 4: Single letter A, B, C... (Spreadsheet column reference)
  if (/^[a-z]$/.test(lowerRef)) {
    const idx = lowerRef.charCodeAt(0) - 97;
    if (idx >= 0 && idx < ctx.row.length) {
      const parsed = parseFloat(ctx.row[idx]);
      if (!isNaN(parsed)) return parsed;
    }
  }

  // Pattern 5: Exact header name match
  const headerIdx = ctx.headers.findIndex(
    (h) => h.trim().toLowerCase() === lowerRef
  );
  if (headerIdx !== -1 && headerIdx < ctx.row.length) {
    const parsed = parseFloat(ctx.row[headerIdx]);
    if (!isNaN(parsed)) return parsed;
  }

  return NaN;
}

/**
 * Parser class implementing recursive descent for mathematical grammar.
 * Precedence:
 * 1. Expression: Addition & Subtraction
 * 2. Term: Multiplication & Division
 * 3. Power: Exponentiation (^)
 * 4. Unary: Unary minus / plus
 * 5. Primary: Numbers, Parentheses, Functions, Variables/Columns
 */
class FormulaParser {
  private tokens: Token[];
  private current: number = 0;
  private ctx: FormulaContext;

  constructor(tokens: Token[], ctx: FormulaContext) {
    this.tokens = tokens;
    this.ctx = ctx;
  }

  private peek(): Token {
    return this.tokens[this.current] || { type: "EOF", value: "" };
  }

  private advance(): Token {
    const token = this.peek();
    if (token.type !== "EOF") this.current++;
    return token;
  }

  private match(type: TokenType, value?: string): boolean {
    const token = this.peek();
    if (token.type !== type) return false;
    if (value !== undefined && token.value !== value) return false;
    this.advance();
    return true;
  }

  parse(): number {
    const result = this.expression();
    if (this.peek().type !== "EOF") {
      throw new Error(`Unexpected token '${this.peek().value}'`);
    }
    return result;
  }

  // expr = term ( ('+' | '-') term )*
  private expression(): number {
    let left = this.term();

    while (this.peek().type === "OPERATOR" && ["+", "-"].includes(this.peek().value)) {
      const op = this.advance().value;
      const right = this.term();
      if (op === "+") left += right;
      else left -= right;
    }

    return left;
  }

  // term = power ( ('*' | '/') power )*
  private term(): number {
    let left = this.power();

    while (this.peek().type === "OPERATOR" && ["*", "/"].includes(this.peek().value)) {
      const op = this.advance().value;
      const right = this.power();
      if (op === "*") left *= right;
      else {
        if (right === 0) throw new Error("Division by zero");
        left /= right;
      }
    }

    return left;
  }

  // power = unary ( '^' unary )*
  private power(): number {
    const base = this.unary();

    if (this.peek().type === "OPERATOR" && this.peek().value === "^") {
      this.advance();
      const exponent = this.unary();
      return Math.pow(base, exponent);
    }

    return base;
  }

  // unary = ('-' | '+') unary | primary
  private unary(): number {
    if (this.peek().type === "OPERATOR" && ["+", "-"].includes(this.peek().value)) {
      const op = this.advance().value;
      const val = this.unary();
      return op === "-" ? -val : val;
    }
    return this.primary();
  }

  // primary = NUMBER | LPAREN expr RPAREN | FUNCTION LPAREN args RPAREN | IDENTIFIER
  private primary(): number {
    const token = this.peek();

    // Number literal
    if (this.match("NUMBER")) {
      return parseFloat(token.value);
    }

    // Parentheses grouping
    if (this.match("LPAREN")) {
      const val = this.expression();
      if (!this.match("RPAREN")) {
        throw new Error("Missing closing parenthesis ')'");
      }
      return val;
    }

    // Identifiers (functions, constants, column references)
    if (token.type === "IDENTIFIER") {
      this.advance();
      const id = token.value.toLowerCase();

      // Check if it's a function call (followed by '(')
      if (this.peek().type === "LPAREN") {
        this.advance(); // consume '('
        const args: number[] = [];
        if (this.peek().type !== "RPAREN") {
          args.push(this.expression());
          while (this.match("COMMA")) {
            args.push(this.expression());
          }
        }
        if (!this.match("RPAREN")) {
          throw new Error(`Missing closing parenthesis for function '${token.value}'`);
        }
        return this.executeFunction(id, args);
      }

      // Check for mathematical constants
      if (id === "pi") return Math.PI;
      if (id === "e") return Math.E;
      if (id === "g") return 9.80665; // Earth acceleration due to gravity
      if (id === "c") return 299792458; // Speed of light in m/s

      // Otherwise, resolve as column reference
      const colVal = resolveColumnValue(token.value, this.ctx);
      if (isNaN(colVal)) {
        throw new Error(`Invalid column or empty value for '${token.value}'`);
      }
      return colVal;
    }

    throw new Error(`Unexpected token '${token.value || "EOF"}'`);
  }

  private executeFunction(fn: string, args: number[]): number {
    const toRad = (angle: number) =>
      this.ctx.angleMode === "rad" ? angle : (angle * Math.PI) / 180;
    const fromRad = (angle: number) =>
      this.ctx.angleMode === "rad" ? angle : (angle * 180) / Math.PI;

    switch (fn) {
      case "log":
      case "log10":
        if (args[0] <= 0) throw new Error("Log of non-positive number");
        return Math.log10(args[0]);

      case "ln":
        if (args[0] <= 0) throw new Error("Ln of non-positive number");
        return Math.log(args[0]);

      case "log2":
        if (args[0] <= 0) throw new Error("Log2 of non-positive number");
        return Math.log2(args[0]);

      case "sqrt":
        if (args[0] < 0) throw new Error("Square root of negative number");
        return Math.sqrt(args[0]);

      case "cbrt":
        return Math.cbrt(args[0]);

      case "sin":
        return Math.sin(toRad(args[0]));

      case "cos":
        return Math.cos(toRad(args[0]));

      case "tan":
        return Math.tan(toRad(args[0]));

      case "asin":
        if (args[0] < -1 || args[0] > 1) throw new Error("Asin domain error [-1, 1]");
        return fromRad(Math.asin(args[0]));

      case "acos":
        if (args[0] < -1 || args[0] > 1) throw new Error("Acos domain error [-1, 1]");
        return fromRad(Math.acos(args[0]));

      case "atan":
        return fromRad(Math.atan(args[0]));

      case "abs":
        return Math.abs(args[0]);

      case "exp":
        return Math.exp(args[0]);

      case "round": {
        const decimals = args[1] !== undefined ? Math.floor(args[1]) : 0;
        const factor = Math.pow(10, decimals);
        return Math.round(args[0] * factor) / factor;
      }

      default:
        throw new Error(`Unknown function '${fn}'`);
    }
  }
}

/**
 * Format a numeric result according to precision settings.
 */
export function formatResult(val: number, precision: string = "auto"): string {
  if (isNaN(val) || !isFinite(val)) return "ERR!";

  if (precision === "scientific") {
    return val.toExponential(3);
  }

  const decimals = parseInt(precision, 10);
  if (!isNaN(decimals) && decimals >= 0 && decimals <= 6) {
    return val.toFixed(decimals);
  }

  // Auto precision: trim unnecessary trailing zeros
  const rounded = Math.round(val * 10000) / 10000;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(3).replace(/\.?0+$/, "");
}

/**
 * Evaluate a formula on a single row.
 */
export function evaluateFormulaOnRow(
  formula: string,
  headers: string[],
  row: string[],
  angleMode: "deg" | "rad" = "deg",
  precision: string = "auto"
): FormulaResult {
  if (!formula || formula.trim() === "") {
    return { success: false, error: "Formula is empty" };
  }

  try {
    const tokens = tokenize(formula);
    const parser = new FormulaParser(tokens, { headers, row, angleMode });
    const num = parser.parse();

    if (isNaN(num) || !isFinite(num)) {
      return { success: false, error: "Result is not a finite number" };
    }

    return {
      success: true,
      value: num,
      formatted: formatResult(num, precision),
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Formula syntax error",
    };
  }
}

/**
 * Common lab formula presets for quick 1-click application.
 */
export interface LabPreset {
  id: string;
  name: string;
  template: (colA: string, colB?: string) => string;
  description: string;
}

export const LAB_FORMULA_PRESETS: LabPreset[] = [
  {
    id: "ratio",
    name: "Ratio (A ÷ B)",
    template: (a, b) => `${a} / ${b || "col1"}`,
    description: "e.g., Resistance R = V / I or Speed v = d / t",
  },
  {
    id: "log10",
    name: "Logarithm (log₁₀ A)",
    template: (a) => `log10(${a})`,
    description: "Common for pH, dB, and decay calculations",
  },
  {
    id: "ln",
    name: "Natural Log (ln A)",
    template: (a) => `ln(${a})`,
    description: "Kinetics, half-life, and thermodynamic graphs",
  },
  {
    id: "square",
    name: "Square (A²)",
    template: (a) => `${a}^2`,
    description: "Kinetic energy, period squared T², power I²R",
  },
  {
    id: "sqrt",
    name: "Square Root (√A)",
    template: (a) => `sqrt(${a})`,
    description: "Pendulum period, velocity from height",
  },
  {
    id: "invert",
    name: "Inverse (1 ÷ A)",
    template: (a) => `1 / ${a}`,
    description: "Focal length 1/f, frequency 1/T",
  },
  {
    id: "diff",
    name: "Difference (A − B)",
    template: (a, b) => `${a} - ${b || "col1"}`,
    description: "Delta changes Δx = x - x₀",
  },
  {
    id: "percent_error",
    name: "Percent Error (|A−Exp|)",
    template: (a, b) => `abs(${a} - ${b || "100"}) / ${b || "100"} * 100`,
    description: "Discrepancy |A - Exp| / Exp × 100",
  },
];
