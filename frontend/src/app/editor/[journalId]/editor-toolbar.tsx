"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Send,
  Download,
  History,
  MessageSquare,
  Lock,
  HelpCircle,
  RefreshCw,
} from "lucide-react";
import { useDocumentStore } from "./use-document-store";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatTimeIST } from "@/lib/date";
import { cn } from "@/lib/utils";

interface EditorToolbarProps {
  onSave: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  onUnsubmit: () => void;
  isUnsubmitting: boolean;
  classroomId: string;
  onToggleVersionHistory?: () => void;
  onToggleReviewDrawer?: () => void;
  showReviewDrawer?: boolean;
  onToggleHelp?: () => void;
  userRole?: string;
  canUnsubmit?: boolean;
}

export default function EditorToolbar({
  onSave,
  onSubmit,
  isSubmitting,
  onUnsubmit,
  isUnsubmitting,
  classroomId,
  onToggleVersionHistory,
  onToggleReviewDrawer,
  showReviewDrawer,
  onToggleHelp,
  userRole,
  canUnsubmit = true,
}: EditorToolbarProps) {
  const {
    title,
    setTitle,
    isDirty,
    isSaving,
    syncStatus,
    activeRevisionNumber,
    lastSavedAt,
    previewMode,
    togglePreview,
    status,
    journalId,
  } = useDocumentStore();

  const isEditable = status === "draft" || status === "changes_requested";
  const isTeacher = userRole?.toLowerCase() === "teacher";

  return (
    <header className="fixed top-3 left-3 right-3 sm:left-8 sm:right-8 md:left-12 md:right-12 z-40 flex items-center justify-between px-3 sm:px-4 py-2 bg-gradient-to-b from-white/95 via-white/85 to-white/75 dark:from-zinc-900/95 dark:via-zinc-900/90 dark:to-zinc-950/85 backdrop-blur-2xl backdrop-saturate-180 border border-white/80 dark:border-white/10 ring-1 ring-black/5 dark:ring-white/10 shadow-xl rounded-2xl select-none transition-all duration-300">
      {/* Left: Back Button, Divider & Title Input */}
      <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 pr-2 sm:pr-4">
        <Link
          href={classroomId ? `/classrooms/${classroomId}` : "/dashboard"}
          title={classroomId ? "Back to Classroom" : "Back to Dashboard"}
          className="flex items-center justify-center size-8 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95 transition-all duration-200 cursor-pointer shrink-0 border border-border/40"
        >
          <ArrowLeft className="size-4" />
        </Link>

        <div className="h-4 w-px bg-border/80 shrink-0" aria-hidden="true" />

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled Experiment Record"
          disabled={!isEditable}
          className="bg-transparent text-xs sm:text-sm md:text-base font-bold text-foreground border-0 border-b border-transparent hover:border-border/50 focus:border-primary/50 focus:ring-0 focus:outline-none px-2 py-0.5 rounded-lg transition-all min-w-[130px] max-w-[260px] sm:max-w-[340px] w-full text-ellipsis placeholder:text-muted-foreground/50 disabled:pointer-events-none"
        />
      </div>

      {/* Right: Controls & Actions */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* 1. Unified Status & Sync Indicator */}
        <button
          type="button"
          onClick={isDirty && isEditable ? onSave : undefined}
          disabled={!isDirty || isSaving || !isEditable}
          title={
            isDirty
              ? "Unsaved changes · Click to save draft now (Ctrl+S)"
              : lastSavedAt
              ? `Saved to cloud at ${formatTimeIST(lastSavedAt)}`
              : "All changes synced"
          }
          className={cn(
            "hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all select-none border",
            isDirty && isEditable
              ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 cursor-pointer animate-pulse"
              : "bg-muted/40 border-border/50 text-muted-foreground cursor-default"
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full shrink-0",
              syncStatus === "saving" || isSaving
                ? "bg-blue-500 animate-pulse"
                : syncStatus === "conflict"
                ? "bg-rose-500 animate-bounce"
                : syncStatus === "offline"
                ? "bg-zinc-400"
                : isDirty
                ? "bg-amber-500"
                : "bg-emerald-500"
            )}
          />
          <span className="text-[11px] font-semibold">
            {syncStatus === "saving" || isSaving
              ? "Saving..."
              : syncStatus === "conflict"
              ? "Conflict"
              : syncStatus === "offline"
              ? "Offline"
              : isDirty
              ? "Save Draft"
              : "Saved"}
          </span>
          <span className="text-border/80">·</span>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">
            {status === "approved"
              ? "Approved"
              : status === "changes_requested"
              ? `Changes (v${activeRevisionNumber || 1})`
              : status === "late_submitted"
              ? `Late (v${activeRevisionNumber || 1})`
              : status === "submitted"
              ? `Submitted (v${activeRevisionNumber || 1})`
              : `v${activeRevisionNumber || 1}`}
          </span>
        </button>

        {/* 2. Teacher Specific Controls OR Student View Mode */}
        {isTeacher ? (
          <>
            {/* Review Drawer Button */}
            {onToggleReviewDrawer && (
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleReviewDrawer}
                className={cn(
                  "gap-1.5 text-xs font-semibold rounded-xl h-8 px-2.5 cursor-pointer transition-all active:scale-95",
                  showReviewDrawer
                    ? "border-indigo-500/60 bg-indigo-500/20 text-indigo-600 dark:text-indigo-300"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Toggle Teacher Review & Annotation Drawer"
              >
                <MessageSquare className={cn("size-3.5", showReviewDrawer && "text-indigo-500")} />
                <span className="hidden sm:inline">Review</span>
              </Button>
            )}

            {/* Status Pill for Teacher */}
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border",
                status === "approved"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : status === "changes_requested"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : status === "late_submitted"
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                  : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
              )}
            >
              {status === "approved"
                ? "Approved"
                : status === "changes_requested"
                ? "Changes Requested"
                : status === "late_submitted"
                ? "Late"
                : "Submitted"}
            </span>
          </>
        ) : (
          /* Student View Mode Controls */
          <>
            {status === "approved" ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold select-none"
                title="This journal is approved and locked for evaluation."
              >
                <Lock className="size-3.5" />
                <span className="hidden sm:inline">Approved (Read Only)</span>
              </div>
            ) : status === "submitted" || status === "late_submitted" ? (
              canUnsubmit ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUnsubmit}
                  disabled={isUnsubmitting}
                  className="gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 rounded-xl h-8 px-2.5 active:scale-95 transition-all cursor-pointer"
                  title="Unsubmit this journal to resume drafting or make changes"
                >
                  {isUnsubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                  <span>Undo Hand In</span>
                </Button>
              ) : (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-muted/60 border border-border/50 text-muted-foreground text-xs font-semibold select-none"
                  title="Submissions past the deadline are locked and cannot be unsubmitted"
                >
                  <Lock className="size-3.5" />
                  <span>Submitted (Locked)</span>
                </div>
              )
            ) : (
              /* Apple HIG Segmented Mode Switch */
              <div className="flex items-center p-0.5 rounded-xl bg-muted/60 dark:bg-zinc-800/80 border border-border/50 select-none">
                <button
                  type="button"
                  onClick={() => previewMode && togglePreview()}
                  className={cn(
                    "flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs transition-all duration-200 cursor-pointer",
                    !previewMode
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground font-medium"
                  )}
                  title="Edit Mode (Write & format blocks)"
                >
                  <EyeOff className="size-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => !previewMode && togglePreview()}
                  className={cn(
                    "flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs transition-all duration-200 cursor-pointer",
                    previewMode
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground font-medium"
                  )}
                  title="Preview Mode (Clean reader sheet view)"
                >
                  <Eye className="size-3.5" />
                  <span className="hidden sm:inline">Preview</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* 3. Utility Actions Cluster (Tactile Icon Group) */}
        <div className="flex items-center gap-1 border-l border-border/60 pl-2">
          {/* Version History Drawer */}
          {onToggleVersionHistory && (
            <button
              type="button"
              onClick={onToggleVersionHistory}
              title="Version History & Snapshots"
              className="size-8 rounded-xl bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            >
              <History className="size-3.5 text-indigo-500" />
            </button>
          )}

          {/* PDF Export */}
          <Link
            href={`/classrooms/${classroomId}/compile-journal?journalId=${journalId}`}
            title="Preview & Export as Printable PDF"
            className="size-8 rounded-xl bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
          >
            <Download className="size-3.5 text-primary" />
          </Link>

          {/* Guide / Handbook */}
          {onToggleHelp && (
            <button
              type="button"
              onClick={onToggleHelp}
              title="Editor Guide & Student Handbook (?)"
              className="size-8 rounded-xl bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            >
              <HelpCircle className="size-3.5 text-blue-500" />
            </button>
          )}

          {/* Theme Toggle (Dark/Light with Circular View Transition) */}
          <ThemeToggle />
        </div>

        {/* 4. Student Primary Actions (Save & Hand In) */}
        {!isTeacher && (
          <div className="flex items-center gap-1.5 ml-0.5">
            {isEditable && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSave}
                disabled={!isDirty || isSaving}
                className="gap-1.5 text-xs font-semibold shadow-xs hover:shadow active:scale-95 transition-all cursor-pointer disabled:pointer-events-none rounded-xl h-8"
              >
                <Save className="size-3.5" />
                <span>Save Draft</span>
              </Button>
            )}

            {/* Hand In / Resubmit Button */}
            {isEditable ? (
              <Button
                variant="default"
                size="sm"
                onClick={onSubmit}
                disabled={isDirty || isSaving || isSubmitting}
                className={`gap-1.5 text-xs font-semibold shadow-xs hover:shadow active:scale-95 transition-all cursor-pointer disabled:pointer-events-none rounded-xl h-8 ${
                  status === "changes_requested"
                    ? "glass-btn-amber border-amber-500/40 text-amber-700 dark:text-amber-300"
                    : "glass-btn-emerald"
                }`}
              >
                {isSubmitting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                <span>{status === "changes_requested" ? "Resubmit Changes" : "Hand In"}</span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                disabled
                className="gap-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 disabled:opacity-100 rounded-xl h-8"
              >
                <Check className="size-3.5" />
                <span>{status === "approved" ? "Approved" : "Handed In"}</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
