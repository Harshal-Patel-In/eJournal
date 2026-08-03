"use client";

import Link from "next/link";
import { ArrowLeft, Check, Eye, EyeOff, Save, Loader2, Send, Download, ChevronDown, RefreshCw } from "lucide-react";
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
}

export default function EditorToolbar({
  onSave,
  onSubmit,
  isSubmitting,
  onUnsubmit,
  isUnsubmitting,
  classroomId,
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

  const [showExportMenu, setShowExportMenu] = useState(false);
  const isEditable = status === "draft" || status === "changes_requested";

  const handleExportClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof window !== "undefined" && !navigator.onLine) {
      e.preventDefault();
      alert(
        "⚠️ Internet Connection Offline\n\nPlease check your network connection before exporting your journal to ensure high-quality mathematical rendering."
      );
      setShowExportMenu(false);
      return;
    }
    setShowExportMenu(false);
  };

  return (
    <>
      {/* 1. Crystal Apple Liquid Glass Floating Back Button */}
      <div className="fixed top-4 left-[194px] z-40 select-none">
        <Link
          href={`/classrooms/${classroomId}`}
          title="Back to Classroom"
          className="flex items-center justify-center size-9 rounded-full bg-gradient-to-b from-white/80 via-white/65 to-white/50 dark:from-zinc-900/85 dark:via-zinc-900/75 dark:to-zinc-950/70 backdrop-blur-2xl backdrop-saturate-180 border border-white/80 dark:border-white/15 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.1),_inset_0_1px_1px_0_rgba(255,255,255,0.95),_inset_0_-1px_1px_0_rgba(0,0,0,0.05)] dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.7),_inset_0_1px_1px_0_rgba(255,255,255,0.18),_inset_0_-1px_1px_0_rgba(0,0,0,0.5)] text-muted-foreground hover:text-foreground hover:from-white/90 hover:to-white/65 dark:hover:from-zinc-800/95 dark:hover:to-zinc-900/90 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
        >
          <ArrowLeft className="size-4" />
        </Link>
      </div>

      {/* 2. Crystal Apple Liquid Glass Floating Header Bar */}
      <header className="fixed top-4 left-60 right-60 z-40 flex items-center justify-between px-5 py-1.5 bg-gradient-to-b from-white/80 via-white/65 to-white/50 dark:from-zinc-900/85 dark:via-zinc-900/75 dark:to-zinc-950/70 backdrop-blur-2xl backdrop-saturate-180 border border-white/80 dark:border-white/15 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.1),_inset_0_1px_1px_0_rgba(255,255,255,0.95),_inset_0_-1px_1px_0_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7),_inset_0_1px_1px_0_rgba(255,255,255,0.18),_inset_0_-1px_1px_0_rgba(0,0,0,0.5)] rounded-2xl select-none transition-all duration-300">
        {/* Left: Journal Title */}
        <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled Journal"
            disabled={!isEditable}
            className="bg-transparent text-sm md:text-base font-bold border-0 border-b border-transparent hover:border-border/60 focus:border-primary focus:ring-0 focus:outline-none px-2 py-0.5 rounded transition-all max-w-[360px] w-full text-ellipsis placeholder:text-muted-foreground/60 disabled:pointer-events-none"
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
              className="gap-1.5 text-xs font-medium cursor-pointer text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 hover:border-rose-300 rounded-xl h-8"
            >
              {isUnsubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Undoing...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="size-3.5" />
                  <span>Undo Hand In</span>
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={togglePreview}
              className="gap-1.5 text-xs font-medium cursor-pointer rounded-xl h-8 active:scale-95 transition-all duration-150 ease-out"
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

          {/* Export Dropdown Menu */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="gap-1 text-xs font-semibold transition-all duration-150 ease-out active:scale-95 cursor-pointer text-muted-foreground hover:text-foreground rounded-xl h-8"
            >
              <Download className="size-3.5" />
              <span>Export</span>
              <ChevronDown className="size-3" />
            </Button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-white/60 dark:border-white/20 ring-1 ring-black/5 dark:ring-white/10 bg-gradient-to-b from-white/85 to-white/60 dark:from-gray-900/90 dark:to-gray-900/75 backdrop-blur-2xl shadow-2xl shadow-black/10 dark:shadow-black/40 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.2)] z-50 p-1.5 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-150 select-none">
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/journals/${journalId}/export/pdf`}
                  download
                  onClick={handleExportClick}
                  className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-muted active:scale-98 rounded-xl flex items-center gap-2 text-foreground transition-all cursor-pointer"
                >
                  <span>📄</span> Export to PDF
                </a>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/journals/${journalId}/export/docx`}
                  download
                  onClick={handleExportClick}
                  className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-muted active:scale-98 rounded-xl flex items-center gap-2 text-foreground transition-all cursor-pointer"
                >
                  <span>📝</span> Export to Word (.docx)
                </a>
              </div>
            )}
          </div>

          {/* Theme Toggle (Night / Light Mode) */}
          <ThemeToggle />
          {isEditable && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSave}
              disabled={!isDirty || isSaving}
              className="gap-1.5 text-xs font-semibold shadow-xs hover:shadow active:scale-95 transition-all duration-150 ease-out cursor-pointer disabled:pointer-events-none text-muted-foreground hover:text-foreground rounded-xl h-8"
            >
              <Save className="size-3.5" />
              <span>Save Draft</span>
            </Button>
          )}

          {/* Hand In Button */}
          {isEditable ? (
            <Button
              variant="default"
              size="sm"
              onClick={onSubmit}
              disabled={isDirty || isSaving || isSubmitting}
              className="gap-1.5 text-xs font-semibold shadow-xs hover:shadow active:scale-95 glass-btn-emerald transition-all duration-150 ease-out cursor-pointer disabled:pointer-events-none rounded-xl h-8"
              title={isDirty ? "Save draft changes before handing in" : "Submit journal for grading"}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Handing In...</span>
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  <span>Hand In</span>
                </>
              )}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              {status === "submitted" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUnsubmit}
                  disabled={isUnsubmitting}
                  className="gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 hover:border-rose-300 transition-all cursor-pointer disabled:pointer-events-none rounded-xl h-8"
                >
                  {isUnsubmitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Undoing...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-3.5" />
                      <span>Undo Hand In</span>
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled
                className="gap-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 disabled:opacity-100 rounded-xl h-8"
              >
                <Check className="size-3.5" />
                <span>{status === "approved" ? "Approved" : "Handed In"}</span>
              </Button>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
