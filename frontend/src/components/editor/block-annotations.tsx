"use client";

import { useState } from "react";
import {
  MessageSquare,
  Sparkles,
  Highlighter,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Annotation {
  id: string;
  blockId: string;
  type: string;
  content?: string;
  message?: string;
  authorName: string;
  reviewStatus?: string;
  status?: string;
  suggestedContent?: any;
  createdAt?: string;
}

interface BlockAnnotationsProps {
  annotations: Annotation[];
  isTeacher: boolean;
  onApplySuggestion?: (commentId: string) => void;
}

const TYPE_CONFIG: Record<string, {
  icon: any;
  label: string;
  color: string;       // text color
  bgColor: string;     // background tint
  borderColor: string; // left border accent
  badgeBg: string;     // badge background
  emoji: string;
}> = {
  Comment: {
    icon: MessageSquare,
    label: "Comment",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50/80 dark:bg-blue-950/20",
    borderColor: "border-l-blue-500",
    badgeBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-400/30",
    emoji: "💬",
  },
  Suggestion: {
    icon: Sparkles,
    label: "Suggestion",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50/80 dark:bg-amber-950/20",
    borderColor: "border-l-amber-500",
    badgeBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-400/30",
    emoji: "✨",
  },
  Highlight: {
    icon: Highlighter,
    label: "Highlight",
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-50/80 dark:bg-cyan-950/20",
    borderColor: "border-l-cyan-500",
    badgeBg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-400/30",
    emoji: "🖍",
  },
  Warning: {
    icon: AlertTriangle,
    label: "Warning",
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-50/80 dark:bg-rose-950/20",
    borderColor: "border-l-rose-500",
    badgeBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-400/30",
    emoji: "⚠️",
  },
  Approval: {
    icon: CheckCircle,
    label: "Approval",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50/80 dark:bg-emerald-950/20",
    borderColor: "border-l-emerald-500",
    badgeBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-400/30",
    emoji: "✅",
  },
  Question: {
    icon: HelpCircle,
    label: "Question",
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50/80 dark:bg-violet-950/20",
    borderColor: "border-l-violet-500",
    badgeBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-400/30",
    emoji: "❓",
  },
};

const DEFAULT_CONFIG = TYPE_CONFIG.Comment;

function getConfig(type: string) {
  return TYPE_CONFIG[type] || DEFAULT_CONFIG;
}

/** Build a compact summary line like: 💬 2 · ⚠️ 1 · ✅ 1 */
function buildSummary(annotations: Annotation[]) {
  const counts: Record<string, number> = {};
  for (const ann of annotations) {
    const t = ann.type || "Comment";
    counts[t] = (counts[t] || 0) + 1;
  }
  return Object.entries(counts).map(([type, count]) => {
    const cfg = getConfig(type);
    return { type, count, emoji: cfg.emoji, label: cfg.label };
  });
}

/** Get the dominant annotation type for the block's left border accent */
function getDominantBorderColor(annotations: Annotation[]): string {
  // Priority: Warning > Question > Suggestion > Comment > Highlight > Approval
  const priority = ["Warning", "Question", "Suggestion", "Comment", "Highlight", "Approval"];
  for (const p of priority) {
    if (annotations.some((a) => a.type === p)) return getConfig(p).borderColor;
  }
  return getConfig("Comment").borderColor;
}

export { getDominantBorderColor, getConfig as getAnnotationConfig };

export default function BlockAnnotations({
  annotations,
  isTeacher,
  onApplySuggestion,
}: BlockAnnotationsProps) {
  const [expanded, setExpanded] = useState(false);

  if (annotations.length === 0) return null;

  const summary = buildSummary(annotations);

  return (
    <div className="mt-2 select-none">
      {/* Collapsed Summary Bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all cursor-pointer group"
      >
        {expanded ? (
          <ChevronDown className="size-3 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
        )}

        <div className="flex items-center gap-2.5">
          {summary.map((s) => (
            <span key={s.type} className="flex items-center gap-1">
              <span>{s.emoji}</span>
              <span className="tabular-nums">{s.count}</span>
              <span className="text-muted-foreground/50 hidden sm:inline">{s.label}{s.count > 1 ? "s" : ""}</span>
            </span>
          ))}
        </div>

        <span className="ml-auto text-[10px] text-muted-foreground/40 font-medium">
          {expanded ? "collapse" : "view"}
        </span>
      </button>

      {/* Expanded Thread */}
      {expanded && (
        <div className="mt-1.5 flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {annotations.map((ann) => {
            const cfg = getConfig(ann.type || "Comment");
            const Icon = cfg.icon;
            const text = ann.content || ann.message || "";

            return (
              <div
                key={ann.id}
                className={`flex flex-col gap-1.5 p-3 rounded-xl border-l-[3px] ${cfg.borderColor} ${cfg.bgColor} border border-border/30 text-xs`}
              >
                {/* Header: Icon + Author + Type Badge */}
                <div className="flex items-center gap-2">
                  <Icon className={`size-3.5 shrink-0 ${cfg.color}`} />
                  <span className="font-bold text-foreground text-[11px]">{ann.authorName}</span>
                  <span className={`ml-auto text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md border ${cfg.badgeBg}`}>
                    {cfg.label}
                  </span>
                </div>

                {/* Content */}
                <p className="text-[11px] text-foreground/80 leading-relaxed pl-[22px]">{text}</p>

                {/* Suggestion Preview */}
                {ann.type === "Suggestion" && ann.suggestedContent && (
                  <div className="ml-[22px] p-2 rounded-lg bg-amber-100/60 dark:bg-amber-900/20 border border-amber-300/30 dark:border-amber-700/30 text-[10px] font-mono text-amber-800 dark:text-amber-200">
                    <span className="font-bold text-amber-600 dark:text-amber-400 text-[9px] uppercase tracking-wider">Suggested: </span>
                    {JSON.stringify(ann.suggestedContent.text || ann.suggestedContent)}
                  </div>
                )}

                {/* Student Actions */}
                {!isTeacher && (
                  <div className="pl-[22px] flex items-center gap-2 pt-0.5">
                    {ann.type === "Suggestion" && ann.status !== "resolved" && onApplySuggestion && (
                      <Button
                        size="sm"
                        onClick={() => onApplySuggestion(ann.id)}
                        className="h-6 text-[10px] font-bold rounded-md gap-1 bg-emerald-600 hover:bg-emerald-500 text-white border-0 cursor-pointer"
                      >
                        <CheckCircle className="size-2.5" />
                        Accept
                      </Button>
                    )}
                    {ann.type === "Suggestion" && ann.status !== "resolved" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] font-medium rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Dismiss
                      </Button>
                    )}
                    {ann.type === "Warning" && ann.status !== "resolved" && (
                      <span className="text-[10px] font-semibold text-rose-500/80 flex items-center gap-1">
                        <AlertTriangle className="size-2.5" />
                        Action required
                      </span>
                    )}
                    {ann.type === "Approval" && (
                      <span className="text-[10px] font-semibold text-emerald-500/80 flex items-center gap-1">
                        <CheckCircle className="size-2.5" />
                        Approved by teacher
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
