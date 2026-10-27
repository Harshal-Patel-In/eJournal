/**
 * Deterministic Classroom Visual Identity & Color Tokens.
 *
 * Grounded in Apple HIG (Color as Identity & Visual Continuity)
 * and Impeccable UI standards.
 */

export interface ClassroomTheme {
  id: string;
  name: string;
  indicator: string;
  notchGlow: string;
  badge: string;
  hoverBorder: string;
  hoverTitle: string;
  bannerGlow: string;
  accentText: string;
  accentBg: string;
  activeBadge: string;
}

export const CLASSROOM_THEMES: ClassroomTheme[] = [
  {
    id: "sky",
    name: "Muted Slate Sky",
    indicator: "bg-sky-500/80 dark:bg-sky-400/70",
    notchGlow: "shadow-[0_0_12px_rgba(14,165,233,0.45)]",
    badge:
      "bg-sky-500/[0.08] text-sky-800 dark:text-sky-300 border-sky-500/25 font-semibold",
    hoverBorder: "hover:border-sky-500/40",
    hoverTitle: "group-hover:text-sky-600 dark:group-hover:text-sky-400",
    bannerGlow: "from-sky-500/15 via-sky-500/5 to-transparent",
    accentText: "text-sky-600 dark:text-sky-400",
    accentBg: "bg-sky-500/10",
    activeBadge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
  {
    id: "emerald",
    name: "Muted Sage Emerald",
    indicator: "bg-emerald-600/80 dark:bg-emerald-400/70",
    notchGlow: "shadow-[0_0_12px_rgba(16,185,129,0.45)]",
    badge:
      "bg-emerald-600/[0.08] text-emerald-800 dark:text-emerald-300 border-emerald-600/25 font-semibold",
    hoverBorder: "hover:border-emerald-600/40",
    hoverTitle: "group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
    bannerGlow: "from-emerald-500/15 via-emerald-500/5 to-transparent",
    accentText: "text-emerald-600 dark:text-emerald-400",
    accentBg: "bg-emerald-500/10",
    activeBadge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  {
    id: "violet",
    name: "Muted Slate Violet",
    indicator: "bg-violet-600/80 dark:bg-violet-400/70",
    notchGlow: "shadow-[0_0_12px_rgba(139,92,246,0.45)]",
    badge:
      "bg-violet-600/[0.08] text-violet-800 dark:text-violet-300 border-violet-600/25 font-semibold",
    hoverBorder: "hover:border-violet-600/40",
    hoverTitle: "group-hover:text-violet-600 dark:group-hover:text-violet-400",
    bannerGlow: "from-violet-500/15 via-violet-500/5 to-transparent",
    accentText: "text-violet-600 dark:text-violet-400",
    accentBg: "bg-violet-500/10",
    activeBadge: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  },
  {
    id: "amber",
    name: "Muted Warm Amber",
    indicator: "bg-amber-600/80 dark:bg-amber-400/70",
    notchGlow: "shadow-[0_0_12px_rgba(245,158,11,0.45)]",
    badge:
      "bg-amber-600/[0.08] text-amber-800 dark:text-amber-300 border-amber-600/25 font-semibold",
    hoverBorder: "hover:border-amber-600/40",
    hoverTitle: "group-hover:text-amber-600 dark:group-hover:text-amber-400",
    bannerGlow: "from-amber-500/15 via-amber-500/5 to-transparent",
    accentText: "text-amber-600 dark:text-amber-400",
    accentBg: "bg-amber-500/10",
    activeBadge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  {
    id: "rose",
    name: "Muted Terracotta / Dusty Rose",
    indicator: "bg-rose-600/80 dark:bg-rose-400/70",
    notchGlow: "shadow-[0_0_12px_rgba(225,29,72,0.45)]",
    badge:
      "bg-rose-600/[0.08] text-rose-800 dark:text-rose-300 border-rose-600/25 font-semibold",
    hoverBorder: "hover:border-rose-600/40",
    hoverTitle: "group-hover:text-rose-600 dark:group-hover:text-rose-400",
    bannerGlow: "from-rose-500/15 via-rose-500/5 to-transparent",
    accentText: "text-rose-600 dark:text-rose-400",
    accentBg: "bg-rose-500/10",
    activeBadge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  },
];

/**
 * Returns a stable, deterministic color identity for a classroom based on its ID.
 */
export function getClassroomTheme(id?: string | null, fallbackIndex = 0): ClassroomTheme {
  if (!id) return CLASSROOM_THEMES[fallbackIndex % CLASSROOM_THEMES.length];
  const charSum = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CLASSROOM_THEMES[charSum % CLASSROOM_THEMES.length];
}
