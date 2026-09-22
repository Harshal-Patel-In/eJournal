"use client";

import { useState, useMemo, useEffect } from "react";
import {
  X,
  Search,
  BookOpen,
  Sparkles,
  Zap,
  Sigma,
  Table as TableIcon,
  LineChart,
  FileText,
  Copy,
  Check,
  Download,
  Send,
  Lightbulb,
  Command,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import KatexRenderer from "@/components/katex-renderer";

interface EditorHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabKey = "quickstart" | "blocks" | "math" | "tables-graphs" | "workflow" | "shortcuts";

interface MathSample {
  title: string;
  category: string;
  latex: string;
  description: string;
}

const MATH_SAMPLES: MathSample[] = [
  // Basic Algebra & Arithmetic
  {
    title: "Fraction & Division",
    category: "Algebra",
    latex: "\\frac{V_{in} - V_{out}}{R_1}",
    description: "Use \\frac{numerator}{denominator} for vertical fractions.",
  },
  {
    title: "Square Root & Exponents",
    category: "Algebra",
    latex: "f_0 = \\frac{1}{2\\pi \\sqrt{L \\cdot C}}",
    description: "Resonance frequency formula with square roots and fractions.",
  },
  {
    title: "Quadratic Formula",
    category: "Algebra",
    latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
    description: "Standard roots of a second-order polynomial equation.",
  },

  // Electrical & Physics
  {
    title: "Ohm's Law & Power",
    category: "Electronics",
    latex: "P = V \\cdot I = I^2 R = \\frac{V^2}{R}",
    description: "Relationship between electrical power, voltage, current, and resistance.",
  },
  {
    title: "Coulomb's Law",
    category: "Physics",
    latex: "F = \\frac{1}{4\\pi \\varepsilon_0} \\frac{|q_1 q_2|}{r^2}",
    description: "Electrostatic force between two charged particles.",
  },
  {
    title: "Euler's Identity",
    category: "Math",
    latex: "e^{j\\omega t} = \\cos(\\omega t) + j\\sin(\\omega t)",
    description: "Phasor and sinusoidal analysis representation.",
  },
  {
    title: "Impedance of RLC Circuit",
    category: "Electronics",
    latex: "Z = \\sqrt{R^2 + \\left(X_L - X_C\\right)^2}",
    description: "Total AC circuit impedance combining reactance and resistance.",
  },

  // Calculus & Advanced
  {
    title: "Definite Integral",
    category: "Calculus",
    latex: "W = \\int_{t_1}^{t_2} p(t) \\, dt",
    description: "Energy calculation by integrating instantaneous power over time.",
  },
  {
    title: "Second-Order Differential",
    category: "Calculus",
    latex: "L\\frac{d^2 i}{dt^2} + R\\frac{di}{dt} + \\frac{1}{C}i = 0",
    description: "Governing differential equation for an undriven series RLC circuit.",
  },
  {
    title: "Summation Series",
    category: "Math",
    latex: "V_{rms} = \\sqrt{\\frac{1}{N} \\sum_{k=1}^{N} v_k^2}",
    description: "Discrete Root Mean Square computation formula.",
  },
  {
    title: "Matrix Representation",
    category: "Linear Algebra",
    latex: "\\begin{bmatrix} V_1 \\\\ V_2 \\end{bmatrix} = \\begin{bmatrix} Z_{11} & Z_{12} \\\\ Z_{21} & Z_{22} \\end{bmatrix} \\begin{bmatrix} I_1 \\\\ I_2 \\end{bmatrix}",
    description: "Two-port network impedance parameter matrix equation.",
  },
];

const GREEK_SYMBOLS = [
  { symbol: "\\alpha", label: "Alpha" },
  { symbol: "\\beta", label: "Beta" },
  { symbol: "\\gamma", label: "Gamma" },
  { symbol: "\\delta", label: "Delta" },
  { symbol: "\\theta", label: "Theta" },
  { symbol: "\\lambda", label: "Lambda" },
  { symbol: "\\mu", label: "Micro / Mu" },
  { symbol: "\\pi", label: "Pi" },
  { symbol: "\\sigma", label: "Sigma" },
  { symbol: "\\omega", label: "Omega (rad/s)" },
  { symbol: "\\Omega", label: "Ohm (Resistance)" },
  { symbol: "\\Delta", label: "Delta (Change)" },
  { symbol: "\\tau", label: "Time Constant" },
  { symbol: "\\eta", label: "Efficiency" },
  { symbol: "\\phi", label: "Phase Angle" },
  { symbol: "\\infty", label: "Infinity" },
];

export default function EditorHelpModal({ isOpen, onClose }: EditorHelpModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("quickstart");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Fallback
    }
  };

  // Filtered Math Samples
  const filteredMath = useMemo(() => {
    if (!searchQuery.trim()) return MATH_SAMPLES;
    const q = searchQuery.toLowerCase();
    return MATH_SAMPLES.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.latex.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-5xl h-[88vh] bg-background/95 border border-border/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden glass-card relative"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Top Header */}
        <header className="px-6 py-4 border-b border-border/70 flex items-center justify-between gap-4 bg-muted/20 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
              <BookOpen className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-foreground truncate">
                  eJournal Editor Student Guide
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Sparkles className="size-3" /> Handbook
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                Interactive guide to writing, math formulas, tables, and lab submissions
              </p>
            </div>
          </div>

          {/* Search bar inside header */}
          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics (e.g. math, table, submit)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/60 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-foreground placeholder:text-muted-foreground/60"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground text-xs"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="size-8 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
              title="Close Guide (Esc)"
            >
              <X className="size-4" />
            </Button>
          </div>
        </header>

        {/* Tab Navigation */}
        <nav className="px-6 border-b border-border/60 bg-muted/10 flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab("quickstart")}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "quickstart"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className="size-3.5 text-amber-500" />
            <span>Quick Start</span>
          </button>

          <button
            onClick={() => setActiveTab("blocks")}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "blocks"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="size-3.5 text-indigo-500" />
            <span>Block Types</span>
          </button>

          <button
            onClick={() => setActiveTab("math")}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "math"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sigma className="size-3.5 text-blue-500" />
            <span>Math & LaTeX Formulas</span>
          </button>

          <button
            onClick={() => setActiveTab("tables-graphs")}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "tables-graphs"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <LineChart className="size-3.5 text-emerald-500" />
            <span>Tables & Graphs</span>
          </button>

          <button
            onClick={() => setActiveTab("workflow")}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "workflow"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Send className="size-3.5 text-rose-500" />
            <span>Submissions & PDF</span>
          </button>

          <button
            onClick={() => setActiveTab("shortcuts")}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "shortcuts"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Command className="size-3.5 text-purple-500" />
            <span>Shortcuts</span>
          </button>
        </nav>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 text-sm">
          {/* 1. QUICK START TAB */}
          {activeTab === "quickstart" && (
            <div className="space-y-8 animate-in fade-in duration-200">
              {/* Introduction Hero Card */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-500/20 flex flex-col sm:flex-row gap-5 items-start">
                <div className="size-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                  <Lightbulb className="size-6" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <h3 className="text-base font-bold text-foreground">Welcome to the eJournal Academic Editor</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    eJournal uses a modern <strong>block-based document canvas</strong> designed specifically for engineering and lab reports. Rather than fighting with messy Word formatting, every heading, paragraph, equation, table, and circuit diagram is a self-contained academic block.
                  </p>
                </div>
              </div>

              {/* 3 Step Workflow */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  The 3-Step Lab Journal Workflow
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-3 shadow-2xs">
                    <div className="size-7 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold text-xs flex items-center justify-center">
                      1
                    </div>
                    <h5 className="font-bold text-foreground">Add Blocks</h5>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Click any item from the left <strong>Toolbox</strong> or type <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">/</kbd> inside any paragraph to insert Math, Tables, Code, or Figures.
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-3 shadow-2xs">
                    <div className="size-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs flex items-center justify-center">
                      2
                    </div>
                    <h5 className="font-bold text-foreground">Automatic Cloud Sync</h5>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Your work is <strong>automatically saved</strong> as you type. Watch the status indicator in the top toolbar to confirm your journal is synced to the cloud.
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-3 shadow-2xs">
                    <div className="size-7 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-extrabold text-xs flex items-center justify-center">
                      3
                    </div>
                    <h5 className="font-bold text-foreground">Preview & Hand In</h5>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Click <strong>Preview Mode</strong> to see how your faculty will see your paper. When finished, click <strong>Hand In</strong> to finalize your submission.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Indicator Meanings */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  Understanding Sync & Status Badges
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl border border-border bg-card flex items-center gap-3">
                    <div className="size-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Saved</p>
                      <p className="text-[11px] text-muted-foreground">All edits are safe in the database</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border bg-card flex items-center gap-3">
                    <div className="size-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Saving...</p>
                      <p className="text-[11px] text-muted-foreground">Actively syncing changes</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border bg-card flex items-center gap-3">
                    <div className="size-2.5 rounded-full bg-amber-500 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Unsaved</p>
                      <p className="text-[11px] text-muted-foreground">Edits pending sync</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border bg-card flex items-center gap-3">
                    <div className="size-2.5 rounded-full bg-rose-500 animate-bounce shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Conflict</p>
                      <p className="text-[11px] text-muted-foreground">Multi-device edit detected</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. BLOCK TYPES TAB */}
          {activeTab === "blocks" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Heading Block */}
                <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs">
                      H1 / H2 / H3
                    </span>
                    <h4 className="font-bold text-foreground">Heading Block</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Organize experiments hierarchically. Use <strong>H1</strong> for Practical Title, <strong>H2</strong> for Aim, Apparatus, Procedure, and <strong>H3</strong> for sub-sections.
                  </p>
                </div>

                {/* Paragraph Block */}
                <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      Text
                    </span>
                    <h4 className="font-bold text-foreground">Paragraph Block</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Write lab procedures, theory, and observations. Select any text to open the floating formatting toolbar (<strong>Bold</strong>, <em>Italic</em>, <code>Code</code>, Highlight, and Math) or use shortcuts (<code>Ctrl+B</code>, <code>Ctrl+I</code>). Type <code>$formula$</code> for live inline KaTeX math!
                  </p>
                </div>

                {/* Equation Block */}
                <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-xs">
                      LaTeX
                    </span>
                    <h4 className="font-bold text-foreground">Math Equation Block</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Textbook-quality mathematical equations powered by KaTeX. Includes live preview, error detection, and quick-insert operator buttons.
                  </p>
                </div>

                {/* Data Table */}
                <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs">
                      Table
                    </span>
                    <h4 className="font-bold text-foreground">Data Table</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Experimental observation table with dynamic rows and columns. Enter column units (e.g. <code>V (Volts)</code>, <code>I (mA)</code>) for laboratory measurements.
                  </p>
                </div>

                {/* Graph Plotter */}
                <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs">
                      Plot
                    </span>
                    <h4 className="font-bold text-foreground">Cartesian Graph Plotter</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Plot $(X, Y)$ coordinates or mathematical functions. Choose line or scatter plots, customize axis ranges, and visually verify lab results directly on the page.
                  </p>
                </div>

                {/* Multi-Image Gallery */}
                <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold text-xs">
                      Gallery
                    </span>
                    <h4 className="font-bold text-foreground">Figure & Multi-Image Gallery</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Upload experimental setups, oscilloscope waveforms, or circuit diagrams. Add captions to individual photos and recover deleted files from the 3-day Recycle Bin.
                  </p>
                </div>

                {/* Code Snippet */}
                <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                      Code
                    </span>
                    <h4 className="font-bold text-foreground">Code Snippet Block</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Syntax-highlighted code editor for Python, C++, Java, MATLAB, and Verilog with line numbering and 1-click clipboard copy.
                  </p>
                </div>

                {/* Observation & Results */}
                <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold text-xs">
                      Analysis
                    </span>
                    <h4 className="font-bold text-foreground">Observations & Results</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Distinct callout cards for recording qualitative observations, error analysis, theoretical vs practical deviations, and final experiment conclusions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. MATH & LATEX CHEATSHEET TAB */}
          {activeTab === "math" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-muted-foreground flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-foreground">Tip:</span> Click the <strong>Copy LaTeX</strong> button on any card below to copy its formula, then paste it directly into your Equation block!
                </div>
              </div>

              {/* Greek Alphabet Grid */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  Common Engineering & Greek Symbols
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
                  {GREEK_SYMBOLS.map((g, idx) => (
                    <button
                      key={idx}
                      onClick={() => copyToClipboard(g.symbol, 100 + idx)}
                      className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted/70 hover:border-primary/40 flex flex-col items-center gap-1 transition-all group cursor-pointer"
                      title={`Click to copy: ${g.symbol}`}
                    >
                      <div className="text-base font-bold text-foreground group-hover:scale-110 transition-transform">
                        <KatexRenderer latex={g.symbol} displayMode={false} />
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                        {copiedIndex === 100 + idx ? "Copied!" : g.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Formula Cards */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  Textbook Equation Templates ({filteredMath.length})
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredMath.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl border border-border bg-card hover:border-border/80 flex flex-col justify-between gap-4 shadow-2xs transition-all"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground">{item.title}</span>
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {item.category}
                          </span>
                        </div>

                        {/* Live KaTeX Render Canvas */}
                        <div className="py-4 px-3 rounded-xl bg-muted/30 border border-border/40 flex items-center justify-center text-center overflow-x-auto">
                          <KatexRenderer latex={item.latex} displayMode={true} />
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                      </div>

                      {/* Code & Copy */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                        <code className="text-[11px] font-mono text-muted-foreground truncate max-w-[260px]">
                          {item.latex}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(item.latex, idx)}
                          className="gap-1.5 text-xs font-medium h-7 rounded-lg cursor-pointer shrink-0"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check className="size-3 text-emerald-500" />
                              <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" />
                              <span>Copy LaTeX</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. TABLES & GRAPHS TAB */}
          {activeTab === "tables-graphs" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Table Guide */}
                <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                      <TableIcon className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Data Tables for Lab Readings</h4>
                      <p className="text-xs text-muted-foreground">Inputting experimental measurements</p>
                    </div>
                  </div>

                  <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed list-disc list-inside">
                    <li><strong>Column Units:</strong> Include SI units in headers (e.g. <code>Current (mA)</code>, <code>Voltage (V)</code>).</li>
                    <li><strong>Adding Rows/Columns:</strong> Use the <code>+ Row</code> and <code>+ Col</code> buttons at the table borders.</li>
                    <li><strong>Auto-Numbering:</strong> The first column can be used as an observation index (1, 2, 3, ...).</li>
                    <li><strong>Formulas:</strong> Use row totals or averages for calculated parameters (e.g. <KatexRenderer latex="R_{avg} = \frac{\sum R}{N}" displayMode={false} />).</li>
                  </ul>
                </div>

                {/* Graph Guide */}
                <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <LineChart className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Plotting Graphs</h4>
                      <p className="text-xs text-muted-foreground">Visualizing laboratory characteristics</p>
                    </div>
                  </div>

                  <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed list-disc list-inside">
                    <li><strong>Scatter vs Line:</strong> Choose <em>Scatter</em> for discrete points and <em>Line</em> for theoretical curves.</li>
                    <li><strong>Axis Titles:</strong> Always label the X-Axis and Y-Axis with physical quantities and units.</li>
                    <li><strong>Auto-Scaling:</strong> The chart automatically adjusts zoom and bounds to fit all data points gracefully.</li>
                    <li><strong>Export Ready:</strong> All graphs render cleanly in high-resolution vector format during PDF compile.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 5. WORKFLOW & SUBMISSIONS TAB */}
          {activeTab === "workflow" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  Lifecycle of an Academic Journal
                </h4>

                <div className="relative border-l-2 border-border/80 ml-4 pl-6 space-y-6">
                  <div className="relative">
                    <div className="absolute -left-[31px] top-1 size-4 rounded-full bg-muted border-2 border-background" />
                    <h5 className="text-sm font-bold text-foreground">1. Draft Mode</h5>
                    <p className="text-xs text-muted-foreground mt-1">
                      You are in full control of editing. Real-time changes are continuously saved to the cloud. You can restore previous checkpoints from <strong>History</strong>.
                    </p>
                  </div>

                  <div className="relative">
                    <div className="absolute -left-[31px] top-1 size-4 rounded-full bg-blue-500 border-2 border-background" />
                    <h5 className="text-sm font-bold text-foreground">2. Hand In (Submission)</h5>
                    <p className="text-xs text-muted-foreground mt-1">
                      Once complete, click <strong>Hand In</strong>. If you are before the assignment deadline, your submission is locked for grading, but you can <strong>Undo Hand In</strong> if you need to make changes.
                    </p>
                  </div>

                  <div className="relative">
                    <div className="absolute -left-[31px] top-1 size-4 rounded-full bg-amber-500 border-2 border-background" />
                    <h5 className="text-sm font-bold text-foreground">3. Changes Requested (Re-submission)</h5>
                    <p className="text-xs text-muted-foreground mt-1">
                      If your faculty requests corrections, your journal enters <strong>Changes Requested</strong>. Faculty review comments will appear inline. Fix the issues and click <strong>Resubmit Changes</strong>.
                    </p>
                  </div>

                  <div className="relative">
                    <div className="absolute -left-[31px] top-1 size-4 rounded-full bg-emerald-500 border-2 border-background" />
                    <h5 className="text-sm font-bold text-foreground">4. Approved & Graded</h5>
                    <p className="text-xs text-muted-foreground mt-1">
                      Once approved, your journal is finalized with faculty marks and signature. The document is permanently locked for academic compliance.
                    </p>
                  </div>
                </div>
              </div>

              {/* 1-Click PDF Export */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-500/10 to-transparent border border-purple-500/20 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h5 className="text-sm font-bold text-foreground">1-Click High-Fidelity PDF Export</h5>
                  <p className="text-xs text-muted-foreground">
                    Click <strong>Export PDF</strong> in the top toolbar to preview and download a formal IEEE-style printed paper with cover page, institutional metadata, and signatures.
                  </p>
                </div>
                <div className="size-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
                  <Download className="size-5" />
                </div>
              </div>
            </div>
          )}

          {/* 6. KEYBOARD SHORTCUTS TAB */}
          {activeTab === "shortcuts" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Productivity Keyboard Shortcuts
              </h4>

              <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border text-[11px] font-bold uppercase text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Shortcut</th>
                      <th className="py-3 px-4">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="py-3 px-4 font-semibold text-foreground">Save Draft</td>
                      <td className="py-3 px-4">
                        <kbd className="px-2 py-1 rounded bg-muted border border-border text-[11px] font-mono">
                          Ctrl+S / Cmd+S
                        </kbd>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">Forces immediate cloud sync</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-foreground">Toggle Preview Mode</td>
                      <td className="py-3 px-4">
                        <kbd className="px-2 py-1 rounded bg-muted border border-border text-[11px] font-mono">
                          Ctrl+P / Cmd+P
                        </kbd>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">Switches between Editor and Document Preview</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-foreground">Open Help Guide</td>
                      <td className="py-3 px-4">
                        <kbd className="px-2 py-1 rounded bg-muted border border-border text-[11px] font-mono">
                          ? or F1
                        </kbd>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">Opens this handbook anytime</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-foreground">Slash Commands</td>
                      <td className="py-3 px-4">
                        <kbd className="px-2 py-1 rounded bg-muted border border-border text-[11px] font-mono">/</kbd>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">Quickly inserts any block from inside text</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-foreground">Bold Text</td>
                      <td className="py-3 px-4">
                        <kbd className="px-2 py-1 rounded bg-muted border border-border text-[11px] font-mono">
                          Ctrl+B / Cmd+B
                        </kbd>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">Toggles **bold** on selected text</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-foreground">Italic Text</td>
                      <td className="py-3 px-4">
                        <kbd className="px-2 py-1 rounded bg-muted border border-border text-[11px] font-mono">
                          Ctrl+I / Cmd+I
                        </kbd>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">Toggles *italic* on selected text</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-foreground">Inline Code</td>
                      <td className="py-3 px-4">
                        <kbd className="px-2 py-1 rounded bg-muted border border-border text-[11px] font-mono">
                          Ctrl+E / Cmd+E
                        </kbd>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">Toggles `code` on selected text</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-foreground">Highlight Text</td>
                      <td className="py-3 px-4">
                        <kbd className="px-2 py-1 rounded bg-muted border border-border text-[11px] font-mono">
                          Ctrl+Shift+H
                        </kbd>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">Highlights text with academic amber mark</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-foreground">Inline Math</td>
                      <td className="py-3 px-4">
                        <kbd className="px-2 py-1 rounded bg-muted border border-border text-[11px] font-mono">
                          Ctrl+Shift+M / $formula$
                        </kbd>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">Renders inline KaTeX math within paragraphs</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-foreground">Close Modals / Menus</td>
                      <td className="py-3 px-4">
                        <kbd className="px-2 py-1 rounded bg-muted border border-border text-[11px] font-mono">
                          Escape
                        </kbd>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">Dismisses popovers, slash menu, or this guide</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <footer className="px-6 py-3.5 border-t border-border/70 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">Esc</kbd>
            <span>to close guide</span>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={onClose}
            className="rounded-xl px-4 h-8 text-xs font-semibold cursor-pointer"
          >
            Got it, return to editor
          </Button>
        </footer>
      </div>
    </div>
  );
}
