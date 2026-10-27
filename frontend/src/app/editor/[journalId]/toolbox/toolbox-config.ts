import {
  Heading,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  Table as TableIcon,
  Image as ImageIcon,
  Code as CodeIcon,
  CheckSquare,
  BookOpen,
  Split,
  FileDown,
  FileSymlink,
  Sigma,
  LineChart,
  type LucideIcon,
} from "lucide-react";

export type CategoryId = "structure" | "math_data" | "media_code" | "analysis" | "layout";

export interface HeadingSubOption {
  level: 1 | 2 | 3;
  label: string;
  sublabel: string;
  icon: LucideIcon;
}

export interface CategoryAccent {
  color: string;
  bg: string;
  activeBorder: string;
  glow: string;
  strokeClass: string;
  dotClass: string;
  markerClass: string;
  tooltipBorder: string;
}

export interface ToolItem {
  id: string;
  type: string;
  label: string;
  icon: LucideIcon;
  payload: Record<string, unknown>;
  hasChildren?: boolean;
  children?: HeadingSubOption[];
  categoryAccent: CategoryAccent;
}

export interface CategoryGroup {
  id: CategoryId;
  label: string;
  accentColor: string;
  items: ToolItem[];
}

export const HEADING_CHILDREN: HeadingSubOption[] = [
  { level: 1, label: "Heading 1", sublabel: "Section Aim / Title", icon: Heading1 },
  { level: 2, label: "Heading 2", sublabel: "Method / Subsection", icon: Heading2 },
  { level: 3, label: "Heading 3", sublabel: "Minor Sub-item", icon: Heading3 },
];

export const CATEGORIES: CategoryGroup[] = [
  {
    id: "structure",
    label: "Structure",
    accentColor: "text-blue-600 dark:text-blue-400",
    items: [
      {
        id: "headings",
        type: "heading",
        label: "Headings",
        icon: Heading,
        payload: {},
        hasChildren: true,
        children: HEADING_CHILDREN,
        categoryAccent: {
          color: "text-blue-600 dark:text-blue-400",
          bg: "bg-blue-500/10 dark:bg-blue-500/15",
          activeBorder: "border-blue-500/30",
          glow: "rgba(59,130,246,0.7)",
          strokeClass: "stroke-blue-500 dark:stroke-blue-400",
          dotClass: "bg-blue-500",
          markerClass: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]",
          tooltipBorder: "border-blue-500/30",
        },
      },
      {
        id: "paragraph",
        type: "paragraph",
        label: "Paragraph",
        icon: AlignLeft,
        payload: { text: "" },
        categoryAccent: {
          color: "text-blue-600 dark:text-blue-400",
          bg: "bg-blue-500/10 dark:bg-blue-500/15",
          activeBorder: "border-blue-500/30",
          glow: "rgba(59,130,246,0.7)",
          strokeClass: "stroke-blue-500 dark:stroke-blue-400",
          dotClass: "bg-blue-500",
          markerClass: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]",
          tooltipBorder: "border-blue-500/30",
        },
      },
    ],
  },
  {
    id: "math_data",
    label: "Math & Data",
    accentColor: "text-indigo-600 dark:text-indigo-400",
    items: [
      {
        id: "equation",
        type: "equation",
        label: "Math Equation",
        icon: Sigma,
        payload: { latex: "" },
        categoryAccent: {
          color: "text-indigo-600 dark:text-indigo-400",
          bg: "bg-indigo-500/10 dark:bg-indigo-500/15",
          activeBorder: "border-indigo-500/30",
          glow: "rgba(99,102,241,0.7)",
          strokeClass: "stroke-indigo-500 dark:stroke-indigo-400",
          dotClass: "bg-indigo-500",
          markerClass: "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]",
          tooltipBorder: "border-indigo-500/30",
        },
      },
      {
        id: "table",
        type: "table",
        label: "Data Table",
        icon: TableIcon,
        payload: {
          headers: ["Speed (km/h)", "Distance (m)", "Time (s)"],
          rows: [["", "", ""]],
        },
        categoryAccent: {
          color: "text-emerald-600 dark:text-emerald-400",
          bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
          activeBorder: "border-emerald-500/30",
          glow: "rgba(16,185,129,0.7)",
          strokeClass: "stroke-emerald-500 dark:stroke-emerald-400",
          dotClass: "bg-emerald-500",
          markerClass: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]",
          tooltipBorder: "border-emerald-500/30",
        },
      },
      {
        id: "graph",
        type: "graph",
        label: "Graph Plot",
        icon: LineChart,
        payload: {
          title: "Experimental Graph Plot",
          chartType: "scatter",
          showTrendline: true,
          showGrid: true,
        },
        categoryAccent: {
          color: "text-cyan-600 dark:text-cyan-400",
          bg: "bg-cyan-500/10 dark:bg-cyan-500/15",
          activeBorder: "border-cyan-500/30",
          glow: "rgba(6,182,212,0.7)",
          strokeClass: "stroke-cyan-500 dark:stroke-cyan-400",
          dotClass: "bg-cyan-500",
          markerClass: "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]",
          tooltipBorder: "border-cyan-500/30",
        },
      },
    ],
  },
  {
    id: "media_code",
    label: "Media & Code",
    accentColor: "text-violet-600 dark:text-violet-400",
    items: [
      {
        id: "image",
        type: "image",
        label: "Figure / Image",
        icon: ImageIcon,
        payload: { url: "", caption: "" },
        categoryAccent: {
          color: "text-amber-600 dark:text-amber-400",
          bg: "bg-amber-500/10 dark:bg-amber-500/15",
          activeBorder: "border-amber-500/30",
          glow: "rgba(245,158,11,0.7)",
          strokeClass: "stroke-amber-500 dark:stroke-amber-400",
          dotClass: "bg-amber-500",
          markerClass: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]",
          tooltipBorder: "border-amber-500/30",
        },
      },
      {
        id: "code",
        type: "code",
        label: "Code Snippet",
        icon: CodeIcon,
        payload: { text: "", language: "python" },
        categoryAccent: {
          color: "text-violet-600 dark:text-violet-400",
          bg: "bg-violet-500/10 dark:bg-violet-500/15",
          activeBorder: "border-violet-500/30",
          glow: "rgba(139,92,246,0.7)",
          strokeClass: "stroke-violet-500 dark:stroke-violet-400",
          dotClass: "bg-violet-500",
          markerClass: "bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]",
          tooltipBorder: "border-violet-500/30",
        },
      },
    ],
  },
  {
    id: "analysis",
    label: "Analysis",
    accentColor: "text-amber-600 dark:text-amber-400",
    items: [
      {
        id: "observation",
        type: "observation",
        label: "Observation",
        icon: FileSymlink,
        payload: { text: "" },
        categoryAccent: {
          color: "text-amber-600 dark:text-amber-400",
          bg: "bg-amber-500/10 dark:bg-amber-500/15",
          activeBorder: "border-amber-500/30",
          glow: "rgba(245,158,11,0.7)",
          strokeClass: "stroke-amber-500 dark:stroke-amber-400",
          dotClass: "bg-amber-500",
          markerClass: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]",
          tooltipBorder: "border-amber-500/30",
        },
      },
      {
        id: "result",
        type: "result",
        label: "Result Statement",
        icon: CheckSquare,
        payload: { text: "" },
        categoryAccent: {
          color: "text-emerald-600 dark:text-emerald-400",
          bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
          activeBorder: "border-emerald-500/30",
          glow: "rgba(16,185,129,0.7)",
          strokeClass: "stroke-emerald-500 dark:stroke-emerald-400",
          dotClass: "bg-emerald-500",
          markerClass: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]",
          tooltipBorder: "border-emerald-500/30",
        },
      },
      {
        id: "reference",
        type: "reference",
        label: "Reference",
        icon: BookOpen,
        payload: { text: "" },
        categoryAccent: {
          color: "text-rose-600 dark:text-rose-400",
          bg: "bg-rose-500/10 dark:bg-rose-500/15",
          activeBorder: "border-rose-500/30",
          glow: "rgba(244,63,94,0.7)",
          strokeClass: "stroke-rose-500 dark:stroke-rose-400",
          dotClass: "bg-rose-500",
          markerClass: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]",
          tooltipBorder: "border-rose-500/30",
        },
      },
    ],
  },
  {
    id: "layout",
    label: "Layout",
    accentColor: "text-zinc-600 dark:text-zinc-400",
    items: [
      {
        id: "divider",
        type: "divider",
        label: "Divider",
        icon: Split,
        payload: {},
        categoryAccent: {
          color: "text-zinc-600 dark:text-zinc-400",
          bg: "bg-zinc-500/10 dark:bg-zinc-500/15",
          activeBorder: "border-zinc-500/30",
          glow: "rgba(113,113,122,0.7)",
          strokeClass: "stroke-zinc-500 dark:stroke-zinc-400",
          dotClass: "bg-zinc-500",
          markerClass: "bg-zinc-500 shadow-[0_0_8px_rgba(113,113,122,0.8)]",
          tooltipBorder: "border-zinc-500/30",
        },
      },
      {
        id: "page_break",
        type: "page_break",
        label: "Page Break",
        icon: FileDown,
        payload: {},
        categoryAccent: {
          color: "text-sky-600 dark:text-sky-400",
          bg: "bg-sky-500/10 dark:bg-sky-500/15",
          activeBorder: "border-sky-500/30",
          glow: "rgba(14,165,233,0.7)",
          strokeClass: "stroke-sky-500 dark:stroke-sky-400",
          dotClass: "bg-sky-500",
          markerClass: "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)]",
          tooltipBorder: "border-sky-500/30",
        },
      },
    ],
  },
];
