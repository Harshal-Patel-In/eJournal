"use client";

import Link from "next/link";
import { ArrowLeft, Check, Eye, EyeOff, Save, Loader2, Send, Download, ChevronDown, RefreshCw, History, MessageSquare, ShieldCheck, Printer } from "lucide-react";
import { useDocumentStore } from "./use-document-store";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useState } from "react";

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
  userRole?: string;
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
  userRole,
}: EditorToolbarProps) {
  const {
    title,
    setTitle,
    isDirty,
    isSaving,
    syncStatus,
    clientRevision,
    lastSavedAt,
    previewMode,
    togglePreview,
    status,
    journalId,
  } = useDocumentStore();

  const isEditable = status === "draft" || status === "changes_requested";

  return (
    <header className="fixed top-3 left-4 right-4 sm:left-16 sm:right-16 z-40 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-white/90 via-white/80 to-white/70 dark:from-zinc-900/90 dark:via-zinc-900/85 dark:to-zinc-950/80 backdrop-blur-2xl backdrop-saturate-180 border border-white/80 dark:border-white/15 ring-1 ring-black/5 dark:ring-white/10 shadow-xl rounded-2xl select-none transition-all duration-300">
      {/* Left: Back Button & Journal Title */}
      <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
        <Link
          href={`/classrooms/${classroomId}`}
          title="Back to Classroom"
          className="flex items-center justify-center size-8 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95 transition-all duration-200 cursor-pointer shrink-0"
        >
          <ArrowLeft className="size-4" />
        </Link>

        <div className="h-4 w-px bg-border/80 shrink-0" />

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled Journal"
          disabled={!isEditable}
          className="bg-transparent text-sm sm:text-base font-extrabold text-foreground border-0 border-b border-transparent hover:border-border/60 focus:border-primary focus:ring-0 focus:outline-none px-2 py-0.5 rounded transition-all max-w-[320px] w-full text-ellipsis placeholder:text-muted-foreground/60 disabled:pointer-events-none"
        />
      </div>

        {/* Right: Controls & Status Badges */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Phase 5 Enhanced Saving Status Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1 glass-pill rounded-full select-none">
            {syncStatus === "saving" || isSaving ? (
              <>
                <div className="size-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[11px] font-medium">Saving... (Rev #{clientRevision})</span>
              </>
            ) : syncStatus === "conflict" ? (
              <>
                <div className="size-2 rounded-full bg-rose-500 animate-bounce" />
                <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  Revision Conflict (409)
                </span>
              </>
            ) : syncStatus === "offline" ? (
              <>
                <div className="size-2 rounded-full bg-slate-400" />
                <span className="text-[11px] font-medium">Offline (Saved locally)</span>
              </>
            ) : isDirty || syncStatus === "unsaved" ? (
              <>
                <div className="size-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[11px] font-medium">Unsaved changes</span>
              </>
            ) : (
              <>
                <div className="size-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-medium" title={lastSavedAt ? `Saved at ${new Date(lastSavedAt).toLocaleTimeString()}` : "Synced"}>
                  Saved • Rev #{clientRevision} • Synced
                </span>
              </>
            )}
          </div>


          {/* Teacher Specific Controls */}
          {userRole?.toLowerCase() === "teacher" ? (
            <>
              {/* Teacher Review Panel Toggle */}
              {onToggleReviewDrawer && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleReviewDrawer}
                  className={`gap-1.5 text-xs font-semibold rounded-xl h-8 cursor-pointer transition-all active:scale-95 ${
                    showReviewDrawer
                      ? "border-indigo-500/60 bg-indigo-500/20 text-indigo-600 dark:text-indigo-300"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MessageSquare className={`size-3.5 ${showReviewDrawer ? "text-indigo-500" : ""}`} />
                  <span>Review</span>
                </Button>
              )}

              {/* History Button */}
              {onToggleVersionHistory && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleVersionHistory}
                  className="gap-1.5 text-xs font-semibold cursor-pointer rounded-xl h-8 active:scale-95 transition-all"
                >
                  <History className="size-3.5 text-indigo-500" />
                  <span>History</span>
                </Button>
              )}

              {/* 1-Click High-Fidelity PDF Export */}
              <Link href={`/classrooms/${classroomId}/compile-journal?journalId=${journalId}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer text-foreground hover:bg-muted rounded-xl h-8 shadow-2xs"
                  title="Preview and Export this journal as PDF"
                >
                  <Download className="size-3.5 text-primary" />
                  <span>Export PDF</span>
                </Button>
              </Link>

              <ThemeToggle />

              <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                status === "approved"
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  : status === "changes_requested"
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                  : status === "draft"
                  ? "bg-slate-500/10 text-slate-600 border-slate-500/30"
                  : status === "late_submitted"
                  ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                  : "bg-blue-500/10 text-blue-600 border-blue-500/30"
              }`}>
                {status === "approved" ? "Approved" : status === "changes_requested" ? "Changes Requested" : status === "draft" ? "Draft" : status === "late_submitted" ? "Late" : "Submitted"}
              </span>
            </>
          ) : (
            /* Student Specific Controls */
            <>
              {/* Live Preview Toggle */}
              {status === "approved" ? (
                <Button variant="outline" size="sm" disabled className="gap-1.5 text-xs font-medium opacity-60 rounded-xl h-8">
                  <Eye className="size-3.5" />
                  <span>Read Only</span>
                </Button>
              ) : previewMode && status === "submitted" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUnsubmit}
                  disabled={isUnsubmitting}
                  className="gap-1.5 text-xs font-medium cursor-pointer text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 rounded-xl h-8"
                >
                  {isUnsubmitting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  <span>Undo Hand In</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePreview}
                  className="gap-1.5 text-xs font-medium cursor-pointer rounded-xl h-8 active:scale-95 transition-all"
                >
                  {previewMode ? (
                    <>
                      <EyeOff className="size-3.5" />
                      <span>Edit Mode</span>
                    </>
                  ) : (
                    <>
                      <Eye className="size-3.5" />
                      <span>Preview Mode</span>
                    </>
                  )}
                </Button>
              )}

              {onToggleVersionHistory && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleVersionHistory}
                  className="gap-1.5 text-xs font-semibold cursor-pointer rounded-xl h-8 active:scale-95 transition-all"
                >
                  <History className="size-3.5 text-indigo-500" />
                  <span>History</span>
                </Button>
              )}

              {/* 1-Click High-Fidelity PDF Export */}
              <Link href={`/classrooms/${classroomId}/compile-journal?journalId=${journalId}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer text-foreground hover:bg-muted rounded-xl h-8 shadow-2xs"
                  title="Preview and Export this journal as PDF"
                >
                  <Download className="size-3.5 text-primary" />
                  <span>Export PDF</span>
                </Button>
              </Link>

              <ThemeToggle />

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
            </>
          )}
        </div>
      </header>
    );
  }
