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
  Send,
  Check,
  X,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  CornerDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Annotation {
  id: string;
  blockId: string;
  type: string;
  content?: string;
  message?: string;
  authorName: string;
  authorRole?: string;
  reviewStatus?: string;
  status?: string;
  parentCommentId?: string;
  suggestedContent?: any;
  createdAt?: string;
}

interface CommentNode {
  comment: Annotation;
  children: CommentNode[];
}

interface BlockAnnotationsProps {
  annotations: Annotation[];
  isTeacher: boolean;
  currentUser?: any;
  blockType?: string;
  onApplySuggestion?: (commentId: string) => void;
  onReplyQuestion?: (annotationId: string, replyText: string) => void;
  onRejectSuggestion?: (commentId: string) => void;
  onResolveAnnotation?: (commentId: string) => void;
  onInsertBlockBelow?: () => void;
}

const TYPE_CONFIG: Record<
  string,
  {
    icon: any;
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    badgeBg: string;
    emoji: string;
  }
> = {
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
    bgColor: "bg-rose-50/80 dark:bg-rose-950/20 border-rose-500/40",
    borderColor: "border-l-rose-500",
    badgeBg: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 font-extrabold",
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

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

/** Transform flat array into a Recursive N-Tier Tree Structure */
function buildCommentTree(annotations: Annotation[]): CommentNode[] {
  const nodeMap = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  annotations.forEach((ann) => {
    nodeMap.set(ann.id, { comment: ann, children: [] });
  });

  annotations.forEach((ann) => {
    const node = nodeMap.get(ann.id)!;
    if (ann.parentCommentId && nodeMap.has(ann.parentCommentId)) {
      nodeMap.get(ann.parentCommentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

/** Count total descendants under a node recursively */
function countTotalDescendants(node: CommentNode): number {
  let count = node.children.length;
  for (const child of node.children) {
    count += countTotalDescendants(child);
  }
  return count;
}

/** Build compact summary counts */
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

function getDominantBorderColor(annotations: Annotation[]): string {
  const priority = ["Warning", "Question", "Suggestion", "Comment", "Highlight", "Approval"];
  for (const p of priority) {
    if (annotations.some((a) => a.type === p)) return getConfig(p).borderColor;
  }
  return getConfig("Comment").borderColor;
}

export { getDominantBorderColor, getConfig as getAnnotationConfig };

/** YOUTUBE-STYLE INLINE REPLY COMPOSE BOX */
function InlineReplyBox({
  targetAuthorName,
  userInitial,
  replyText,
  setReplyText,
  onSend,
  onCancel,
}: {
  targetAuthorName: string;
  userInitial: string;
  replyText: string;
  setReplyText: (text: string) => void;
  onSend: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-2.5 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="size-6 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary flex items-center justify-center shrink-0 mt-0.5">
        {userInitial}
      </div>
      <div className="flex-1 flex flex-col gap-2">
        <input
          type="text"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          placeholder={`Reply to @${targetAuthorName.replace(/\s+/g, "")}...`}
          className="w-full bg-transparent border-b border-zinc-300 dark:border-zinc-700 focus:border-primary pb-1 text-xs outline-none text-foreground placeholder:text-muted-foreground/60 transition-colors font-medium"
          autoFocus
        />
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/60 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onSend}
            disabled={!replyText.trim()}
            className="h-7 px-3.5 text-xs font-semibold rounded-full gap-1.5 flex items-center justify-center transition-all bg-blue-600 hover:bg-blue-700 text-white shadow-xs disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-500 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
          >
            <Send className="size-3" />
            <span>Reply</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** RECURSIVE SUB-THREAD TREE (Self-contained segment lines with zero overhang across all levels) */
function SubThreadTree({
  children,
  stemLeftPx,
  curveWidthPx,
  contentLeftPaddingClass,
  isTeacher,
  userInitial,
  activeReplyTargetId,
  setActiveReplyTargetId,
  replyText,
  setReplyText,
  onReplyQuestion,
  onApplySuggestion,
  onRejectSuggestion,
  onResolveAnnotation,
}: {
  children: CommentNode[];
  stemLeftPx: number;
  curveWidthPx: number;
  contentLeftPaddingClass: string;
  isTeacher: boolean;
  userInitial: string;
  activeReplyTargetId: string | null;
  setActiveReplyTargetId: (id: string | null) => void;
  replyText: string;
  setReplyText: (text: string) => void;
  onReplyQuestion?: (annotationId: string, replyText: string) => void;
  onApplySuggestion?: (commentId: string) => void;
  onRejectSuggestion?: (commentId: string) => void;
  onResolveAnnotation?: (commentId: string) => void;
}) {
  return (
    <div className="relative flex flex-col">
      {children.map((childNode, idx) => {
        const ann = childNode.comment;
        const isLast = idx === children.length - 1;
        const text = ann.content || ann.message || "";
        const isReplyingToThis = activeReplyTargetId === ann.id;
        const hasSubChildren = childNode.children.length > 0;

        const handleInitiateReply = () => {
          setActiveReplyTargetId(ann.id);
          const authorHandle = `@${ann.authorName.replace(/\s+/g, "")} `;
          setReplyText(authorHandle);
        };

        const handleSendReply = () => {
          const trimmed = replyText.trim();
          if (trimmed && onReplyQuestion) {
            onReplyQuestion(ann.id, trimmed);
            setReplyText("");
            setActiveReplyTargetId(null);
          }
        };

        return (
          <div key={ann.id} className="relative flex flex-col pt-2.5">
            {/* 1. Precise Segment-Based Vertical Stem Line for this level */}
            <div
              style={{ left: `${stemLeftPx}px` }}
              className={`absolute top-0 w-[1.5px] bg-zinc-300 dark:bg-zinc-700 pointer-events-none ${
                isLast ? "h-[18px]" : "bottom-0"
              }`}
            />

            {/* 2. Seamless 90° Radial SVG Curved Branch Arc */}
            <svg
              style={{ left: `${stemLeftPx}px` }}
              className="absolute top-0 pointer-events-none stroke-zinc-300 dark:stroke-zinc-700"
              width={curveWidthPx}
              height="24"
              viewBox={`0 0 ${curveWidthPx} 24`}
              fill="none"
            >
              <path
                d={`M 1 0 V 6 A 12 12 0 0 0 13 18 H ${curveWidthPx}`}
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>

            {/* 3. Reply Entry Body with Local Lead-in Stem bounded strictly to this entry */}
            <div className="relative flex flex-col">
              {/* Lead-in line dropping from this reply's avatar down to the start of its sub-tree */}
              {hasSubChildren && (
                <div
                  style={{ left: `${stemLeftPx + curveWidthPx + 12}px` }}
                  className="absolute top-[28px] bottom-0 w-[1.5px] bg-zinc-300 dark:bg-zinc-700 pointer-events-none"
                />
              )}

              <div className={`${contentLeftPaddingClass} flex items-start gap-2.5`}>
                <div className="size-6 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary flex items-center justify-center shrink-0 mt-0.5 z-10">
                  {ann.authorName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-foreground hover:underline cursor-pointer">
                      @{ann.authorName.replace(/\s+/g, "_").toLowerCase()}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {formatRelativeTime(ann.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-foreground/90 leading-relaxed font-normal">
                    {text.startsWith("@") ? (
                      <>
                        <span className="text-blue-600 dark:text-blue-400 font-semibold hover:underline mr-1">
                          {text.split(" ")[0]}
                        </span>
                        {text.substring(text.indexOf(" ") + 1)}
                      </>
                    ) : (
                      text
                    )}
                  </p>

                  {/* YouTube Action Bar */}
                  <div className="flex items-center gap-3.5 pt-0.5">
                    <button className="flex items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      <ThumbsUp className="size-3" />
                    </button>
                    <button className="flex items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      <ThumbsDown className="size-3" />
                    </button>
                    <button
                      onClick={handleInitiateReply}
                      className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Reply
                    </button>
                  </div>
                </div>
              </div>

              {/* Inline Compose Box */}
              {isReplyingToThis && (
                <div className={`${contentLeftPaddingClass} pl-8.5`}>
                  <InlineReplyBox
                    targetAuthorName={ann.authorName}
                    userInitial={userInitial}
                    replyText={replyText}
                    setReplyText={setReplyText}
                    onSend={handleSendReply}
                    onCancel={() => setActiveReplyTargetId(null)}
                  />
                </div>
              )}
            </div>

            {/* 4. Recursive Nested Sub-Tree (SubThreadTree renders its own bounded segment lines) */}
            {hasSubChildren && (
              <div
                style={{ marginLeft: `${curveWidthPx + 12}px` }}
                className="relative flex flex-col"
              >
                <SubThreadTree
                  children={childNode.children}
                  stemLeftPx={stemLeftPx}
                  curveWidthPx={24}
                  contentLeftPaddingClass="pl-9"
                  isTeacher={isTeacher}
                  userInitial={userInitial}
                  activeReplyTargetId={activeReplyTargetId}
                  setActiveReplyTargetId={setActiveReplyTargetId}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  onReplyQuestion={onReplyQuestion}
                  onApplySuggestion={onApplySuggestion}
                  onRejectSuggestion={onRejectSuggestion}
                  onResolveAnnotation={onResolveAnnotation}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** ROOT ANNOTATION CARD & THREAD CONTAINER */
function RootThreadNode({
  node,
  isTeacher,
  userInitial,
  activeReplyTargetId,
  setActiveReplyTargetId,
  replyText,
  setReplyText,
  expandedThreads,
  setExpandedThreads,
  onReplyQuestion,
  onApplySuggestion,
  onRejectSuggestion,
  onResolveAnnotation,
  blockType,
  onInsertBlockBelow,
}: {
  node: CommentNode;
  isTeacher: boolean;
  userInitial: string;
  activeReplyTargetId: string | null;
  setActiveReplyTargetId: (id: string | null) => void;
  replyText: string;
  setReplyText: (text: string) => void;
  expandedThreads: Record<string, boolean>;
  setExpandedThreads: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onReplyQuestion?: (annotationId: string, replyText: string) => void;
  onApplySuggestion?: (commentId: string) => void;
  onRejectSuggestion?: (commentId: string) => void;
  onResolveAnnotation?: (commentId: string) => void;
  blockType?: string;
  onInsertBlockBelow?: () => void;
}) {
  const ann = node.comment;
  const type = ann.type || "Comment";
  const cfg = getConfig(type);
  const text = ann.content || ann.message || "";
  const totalDescendants = countTotalDescendants(node);
  const isThreadExpanded = expandedThreads[ann.id] ?? true;
  const isReplyingToRoot = activeReplyTargetId === ann.id;
  const isCardType = type === "Suggestion" || type === "Warning" || type === "Approval";

  const handleInitiateReply = () => {
    setActiveReplyTargetId(ann.id);
    const authorHandle = `@${ann.authorName.replace(/\s+/g, "")} `;
    setReplyText(authorHandle);
  };

  const handleSendReply = () => {
    const trimmed = replyText.trim();
    if (trimmed && onReplyQuestion) {
      onReplyQuestion(ann.id, trimmed);
      setReplyText("");
      setActiveReplyTargetId(null);
    }
  };

  const toggleThread = () => {
    setExpandedThreads((prev) => ({ ...prev, [ann.id]: !(prev[ann.id] ?? true) }));
  };

  return (
    <div className="relative flex flex-col">
      {/* 1. TOP ROOT ANNOTATION CARD / COMMENT */}
      {type === "Approval" ? (
        <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/20 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-200">
                  Section Approved & Verified
                </span>
                <span className="text-[10px] font-medium text-emerald-600/80">by {ann.authorName}</span>
              </div>
              {text && <p className="text-[11px] text-emerald-700/90 font-medium italic">"{text}"</p>}
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40">
            APPROVED
          </span>
        </div>
      ) : type === "Warning" ? (
        <div className="p-3.5 rounded-2xl border-2 border-rose-500/50 bg-rose-50/80 dark:bg-rose-950/30 flex flex-col gap-2 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-black text-rose-700 dark:text-rose-300">
              <AlertTriangle className="size-4 text-rose-500 shrink-0" />
              <span>Warning from {ann.authorName}</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40">
                ACTION REQUIRED
              </span>
              {onResolveAnnotation && (
                <button
                  onClick={() => onResolveAnnotation(ann.id)}
                  className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
          <p className="text-xs font-semibold text-rose-900/90 dark:text-rose-100/90 leading-relaxed pl-6">
            {text}
          </p>
          <div className="pl-6 flex items-center gap-3 pt-1">
            <button
              onClick={handleInitiateReply}
              className="px-2.5 py-1 rounded-full text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CornerDownRight className="size-3.5" />
              <span>Reply</span>
            </button>
          </div>
        </div>
      ) : type === "Suggestion" ? (
        <div className="p-3.5 rounded-2xl border border-amber-500/40 bg-amber-50/80 dark:bg-amber-950/20 flex flex-col gap-2.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-extrabold text-amber-800 dark:text-amber-200">
              <Sparkles className="size-4 text-amber-500 shrink-0" />
              <span>Suggested Edit from {ann.authorName}</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              SUGGESTION
            </span>
          </div>

          {text && <p className="text-xs text-muted-foreground font-medium pl-6">{text}</p>}

          {ann.suggestedContent && (
            <div className="ml-6 p-2.5 rounded-xl bg-amber-100/70 dark:bg-amber-900/30 border border-amber-300/40 text-xs font-mono flex flex-col gap-1 text-amber-900 dark:text-amber-100">
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                Proposed Replacement:
              </span>
              <div className="p-1.5 rounded bg-background/80 font-semibold text-foreground">
                {typeof ann.suggestedContent === "string"
                  ? ann.suggestedContent
                  : ann.suggestedContent.text || JSON.stringify(ann.suggestedContent)}
              </div>
            </div>
          )}

          {!isTeacher && ann.status !== "resolved" && (
            <div className="ml-6 flex flex-wrap items-center gap-2 pt-1">
              {/* If block is not a pure media block and has text replacement, allow Apply */}
              {onApplySuggestion && !["image", "canvas", "graph"].includes(blockType || "") && (
                <Button
                  size="sm"
                  onClick={() => onApplySuggestion(ann.id)}
                  className="h-7 text-xs font-bold rounded-xl gap-1.5 glass-btn-emerald active:scale-95 cursor-pointer"
                  title="Apply proposed replacement directly to block"
                >
                  <Check className="size-3.5" />
                  <span>Apply Exact Text</span>
                </Button>
              )}

              {/* Mark as Addressed (for manual edits, re-uploads, or instructional directives) */}
              {onResolveAnnotation && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onResolveAnnotation(ann.id)}
                  className="h-7 text-xs font-semibold rounded-xl border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
                  title="Mark this feedback resolved after making changes"
                >
                  <CheckCircle className="size-3.5" />
                  <span>Mark as Addressed</span>
                </Button>
              )}

              {/* Quick shortcut to insert a new block below if requested */}
              {onInsertBlockBelow && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onInsertBlockBelow}
                  className="h-7 text-xs font-semibold rounded-xl border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 cursor-pointer"
                  title="Insert a new block below to fulfill request"
                >
                  <span>+ Insert Block Below</span>
                </Button>
              )}

              {onRejectSuggestion && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRejectSuggestion(ann.id)}
                  className="h-7 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3.5" />
                  <span>Reject</span>
                </Button>
              )}
            </div>
          )}

          <div className="pl-6 flex items-center gap-3 pt-1">
            <button
              onClick={handleInitiateReply}
              className="px-2.5 py-1 rounded-full text-xs font-bold text-amber-800 dark:text-amber-200 hover:bg-amber-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CornerDownRight className="size-3.5" />
              <span>Reply</span>
            </button>
          </div>
        </div>
      ) : (
        /* YouTube-Style Root Comment / Question */
        <div className="flex items-start gap-3 py-1">
          <div className="size-8 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary flex items-center justify-center shrink-0 mt-0.5">
            {ann.authorName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground hover:underline cursor-pointer">
                @{ann.authorName.replace(/\s+/g, "_").toLowerCase()}
              </span>
              <span className="text-[11px] text-muted-foreground font-normal">
                {formatRelativeTime(ann.createdAt)}
              </span>
              <span className={`ml-auto px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider border ${cfg.badgeBg}`}>
                {cfg.label}
              </span>
            </div>

            <p className="text-xs text-foreground/90 leading-relaxed font-normal">
              {text}
            </p>

            {/* Action Row */}
            <div className="flex items-center gap-4 pt-1">
              <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <ThumbsUp className="size-3.5" />
              </button>
              <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <ThumbsDown className="size-3.5" />
              </button>
              <button
                onClick={handleInitiateReply}
                className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Reply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Compose Box under Root */}
      {isReplyingToRoot && (
        <div className="ml-11">
          <InlineReplyBox
            targetAuthorName={ann.authorName}
            userInitial={userInitial}
            replyText={replyText}
            setReplyText={setReplyText}
            onSend={handleSendReply}
            onCancel={() => setActiveReplyTargetId(null)}
          />
        </div>
      )}

      {/* 2. RECURSIVE REPLIES THREAD */}
      {node.children.length > 0 && (
        <div className="relative flex flex-col">
          {/* Vertical lead-in stem connecting through the toggle into SubThreadTree */}
          {!isCardType && isThreadExpanded && (
            <div className="absolute left-[16px] top-[-8px] h-[36px] w-[1.5px] bg-zinc-300 dark:bg-zinc-700 pointer-events-none" />
          )}
          {isCardType && isThreadExpanded && (
            <div className="absolute left-[16px] top-0 h-[28px] w-[1.5px] bg-zinc-300 dark:bg-zinc-700 pointer-events-none" />
          )}

          {/* Collapsible toggle (Indented at ml-11 with breathing room) */}
          <div className="ml-11 py-1.5 flex items-center">
            <button
              onClick={toggleThread}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
            >
              <ChevronDown
                className={`size-3.5 transition-transform duration-200 ${
                  isThreadExpanded ? "rotate-180" : ""
                }`}
              />
              <span>
                {isThreadExpanded
                  ? "Hide replies"
                  : `${totalDescendants} ${totalDescendants === 1 ? "reply" : "replies"}`}
              </span>
            </button>
          </div>

          {/* Connected Tree of Replies (Self-contained segment-based stem lines with zero bottom spillover) */}
          {isThreadExpanded && (
            <div className="relative flex flex-col">
              <SubThreadTree
                children={node.children}
                stemLeftPx={16}
                curveWidthPx={30}
                contentLeftPaddingClass="pl-11"
                isTeacher={isTeacher}
                userInitial={userInitial}
                activeReplyTargetId={activeReplyTargetId}
                setActiveReplyTargetId={setActiveReplyTargetId}
                replyText={replyText}
                setReplyText={setReplyText}
                onReplyQuestion={onReplyQuestion}
                onApplySuggestion={onApplySuggestion}
                onRejectSuggestion={onRejectSuggestion}
                onResolveAnnotation={onResolveAnnotation}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BlockAnnotations({
  annotations,
  isTeacher,
  currentUser,
  blockType,
  onApplySuggestion,
  onReplyQuestion,
  onRejectSuggestion,
  onResolveAnnotation,
  onInsertBlockBelow,
}: BlockAnnotationsProps) {
  const [expanded, setExpanded] = useState(true);
  const [activeReplyTargetId, setActiveReplyTargetId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});

  if (annotations.length === 0) return null;

  const treeRoots = buildCommentTree(annotations);
  const summary = buildSummary(annotations);

  const userName = currentUser?.profile?.name || currentUser?.name || "User";
  const userInitial = userName.charAt(0).toUpperCase();

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
              <span className="tabular-nums font-bold text-foreground">{s.count}</span>
              <span className="text-muted-foreground/60 hidden sm:inline">
                {s.label}
                {s.count > 1 ? "s" : ""}
              </span>
            </span>
          ))}
        </div>

        <span className="ml-auto text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider">
          {expanded ? "collapse" : "view annotations"}
        </span>
      </button>

      {/* Expanded Annotation Threads Container */}
      {expanded && (
        <div className="mt-2.5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {treeRoots.map((rootNode) => (
            <RootThreadNode
              key={rootNode.comment.id}
              node={rootNode}
              isTeacher={isTeacher}
              userInitial={userInitial}
              activeReplyTargetId={activeReplyTargetId}
              setActiveReplyTargetId={setActiveReplyTargetId}
              replyText={replyText}
              setReplyText={setReplyText}
              expandedThreads={expandedThreads}
              setExpandedThreads={setExpandedThreads}
              onReplyQuestion={onReplyQuestion}
              onApplySuggestion={onApplySuggestion}
              onRejectSuggestion={onRejectSuggestion}
              onResolveAnnotation={onResolveAnnotation}
              blockType={blockType}
              onInsertBlockBelow={onInsertBlockBelow}
            />
          ))}
        </div>
      )}
    </div>
  );
}
