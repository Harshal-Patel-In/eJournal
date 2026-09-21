/**
 * Fullscreen Version History Studio Modal (Option B).
 *
 * Implements a modern 2-pane Studio layout:
 * - Left pane (68% width): True document preview rendering KaTeX formulas, tables, code snippets, graphs, and headings with previewMode.
 * - Right pane (32% width): Connected Git-style chronological timeline with milestone badges, delta change counts, and filters.
 * - Sticky bottom restore bar with safe forward-revision confirmation and pre-restore safety alerts.
 *
 * RULE-VH01: Historical revisions must remain immutable.
 * RULE-VH05: Restoring a snapshot creates a new forward revision.
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  History,
  GitCommit,
  RotateCcw,
  X,
  Clock,
  BookmarkPlus,
  Table,
  Sigma,
  FileText,
  Code,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Loader2,
  Maximize2,
  Minimize2,
  ArrowLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import BlockRenderer from "@/app/editor/[journalId]/block-renderer";

export interface VersionRecord {
  id: string;
  journalId?: string;
  revisionNumber: number;
  authorId: string;
  authorRole?: string;
  status: string;
  trigger?: string;
  remarks?: string;
  createdAt: string;
  blocks?: any[];
  title?: string;
  blockOrder?: string[];
  changedBlockIds?: string[];
  structureChanged?: boolean;
  isLate?: boolean;
  isRevoked?: boolean;
  isPastSubmission?: boolean;
}

interface VersionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  journalId?: string;
  versions: VersionRecord[];
  currentVersion: number;
  onRestoreVersion: (revisionNumber: number) => void;
  onSubmitVersion?: (revisionNumber: number) => void;
  onCreateCheckpoint?: (remarks: string) => void;
  isRestoring?: boolean;
  isSubmittingVersion?: boolean;
  isCreatingCheckpoint?: boolean;
  userRole?: string;
  journalStatus?: string;
  activeBlocks?: any[];
  activeTitle?: string;
  highlightedRevNumber?: number | null;
}

export function VersionHistoryDrawer({
  isOpen,
  onClose,
  journalId,
  versions,
  currentVersion,
  onRestoreVersion,
  onSubmitVersion,
  onCreateCheckpoint,
  isRestoring = false,
  isSubmittingVersion = false,
  isCreatingCheckpoint = false,
  userRole,
  journalStatus = "draft",
  activeBlocks,
  activeTitle,
  highlightedRevNumber = null,
}: VersionHistoryDrawerProps) {
  // Sort versions descending (latest first)
  const sortedVersions = useMemo(() => {
    return [...versions].sort((a, b) => b.revisionNumber - a.revisionNumber);
  }, [versions]);

  const showActiveDraftNode = journalStatus === "draft" || journalStatus === "changes_requested";

  // Selected revision for preview:
  // 0 represents the active working draft (live uncommitted workspace state)
  // > 0 represents an immutable historical milestone revision snapshot
  const [selectedRevNumber, setSelectedRevNumber] = useState<number>(() => {
    if (showActiveDraftNode) return 0;
    return sortedVersions[0]?.revisionNumber ?? (currentVersion || 1);
  });
  const [filterMilestonesOnly, setFilterMilestonesOnly] = useState(false);
  const [showCheckpointInput, setShowCheckpointInput] = useState(false);
  const [checkpointNote, setCheckpointNote] = useState("");
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  // Sync selected revision when modal opens
  useEffect(() => {
    if (isOpen) {
      if (showActiveDraftNode) {
        setSelectedRevNumber(0);
      } else {
        setSelectedRevNumber(sortedVersions[0]?.revisionNumber ?? (currentVersion || 1));
      }
      setShowConfirmRestore(false);
      setShowConfirmSubmit(false);
      setShowCheckpointInput(false);
    }
  }, [isOpen, showActiveDraftNode, currentVersion, sortedVersions]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        if (showConfirmRestore) setShowConfirmRestore(false);
        else if (showConfirmSubmit) setShowConfirmSubmit(false);
        else if (showCheckpointInput) setShowCheckpointInput(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showConfirmRestore, showConfirmSubmit, showCheckpointInput, onClose]);

  const isViewingDraft = selectedRevNumber === 0;

  // Find metadata for currently selected revision
  const selectedMeta = useMemo(() => {
    if (isViewingDraft) return null;
    return sortedVersions.find((v) => v.revisionNumber === selectedRevNumber) || null;
  }, [sortedVersions, selectedRevNumber, isViewingDraft]);

  // Fetch reconstructed revision document if selectedMeta lacks blocks
  const targetJournalId = journalId || selectedMeta?.journalId;
  const needsFetch = !isViewingDraft && (!selectedMeta?.blocks || selectedMeta.blocks.length === 0);

  const {
    data: fetchedVersionData,
    isLoading: isLoadingReconstruction,
    isError: isReconstructionError,
  } = useQuery({
    queryKey: ["journal-version-reconstruction", targetJournalId, selectedRevNumber],
    queryFn: async () => {
      if (!targetJournalId || !selectedRevNumber || selectedRevNumber === 0) return null;
      const res = await api.get<any>(`/journals/${targetJournalId}/versions/${selectedRevNumber}`);
      return res;
    },
    enabled: isOpen && !!targetJournalId && !!selectedRevNumber && selectedRevNumber > 0 && needsFetch,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  // Semantic check whether the selected revision is identical to the current active draft
  const isSelectedIdenticalToDraft = useMemo(() => {
    if (isViewingDraft || !selectedMeta) return false;
    const targetBlocks = selectedMeta.blocks || fetchedVersionData?.blocks;
    if (!targetBlocks || !activeBlocks) return false;
    if (targetBlocks.length !== activeBlocks.length) return false;
    const cleanA = targetBlocks.map((b: any) => ({ id: b.id, type: b.type, content: b.content }));
    const cleanB = activeBlocks.map((b: any) => ({ id: b.id, type: b.type, content: b.content }));
    return JSON.stringify(cleanA) === JSON.stringify(cleanB);
  }, [isViewingDraft, selectedMeta, fetchedVersionData, activeBlocks]);

  const isTeacher = userRole === "teacher";
  const isLockedState = ["submitted", "late_submitted", "approved"].includes(journalStatus);
  const canRestore = !isTeacher && !isLockedState;
  const isCurrentActive = isViewingDraft || selectedRevNumber === currentVersion;

  // Active blocks to render in the preview canvas
  const displayBlocks: any[] = isViewingDraft
    ? activeBlocks || []
    : selectedMeta?.blocks && selectedMeta.blocks.length > 0
    ? selectedMeta.blocks
    : fetchedVersionData?.blocks || [];

  const displayTitle = isViewingDraft
    ? activeTitle || "Untitled Laboratory Experiment"
    : selectedMeta?.title || fetchedVersionData?.title || activeTitle || "Untitled Laboratory Experiment";

  // Filter logic: Formal academic milestones (submitted, revoked, changes_requested, approved)
  const isMilestone = (v: any) =>
    ["submitted", "late_submitted", "approved", "changes_requested", "revoked", "past_submitted"].includes(v.status) ||
    v.trigger === "submit" ||
    v.trigger === "submission";

  const displayedVersions = filterMilestonesOnly
    ? sortedVersions.filter(isMilestone)
    : sortedVersions;

  const handleCreateCheckpoint = () => {
    if (!onCreateCheckpoint) return;
    onCreateCheckpoint(checkpointNote.trim() || "Manual checkpoint snapshot");
    setCheckpointNote("");
    setShowCheckpointInput(false);
  };

  const handleExecuteRestore = () => {
    onRestoreVersion(selectedRevNumber);
    setShowConfirmRestore(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-5 md:p-6 lg:p-8 animate-in fade-in duration-200 select-none">
      {/* Studio Modal Frame */}
      <div className="relative w-full max-w-[1440px] h-[94vh] bg-background border border-border/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* ==================== 1. TOP STUDIO HEADER BAR ==================== */}
        <header className="h-16 px-6 border-b border-border/70 bg-muted/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-xs">
              <History className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground tracking-tight">
                  Version History Studio
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  Option B Studio
                </span>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Inspect document revisions, review KaTeX formulas & data tables, and safely revert states.
              </p>
            </div>
          </div>

          {/* Quick Header Controls */}
          <div className="flex items-center gap-2.5">
            {/* Create Checkpoint Trigger (Students Only in Draft Mode) */}
            {!isTeacher && !isLockedState && onCreateCheckpoint && (
              <div>
                {!showCheckpointInput ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCheckpointInput(true)}
                    className="h-8 text-xs font-semibold gap-1.5 rounded-xl border-border/80 hover:border-primary/40 hover:bg-primary/5 hover:text-primary cursor-pointer"
                  >
                    <BookmarkPlus className="size-3.5 text-primary" />
                    <span className="hidden md:inline">Bookmark Draft</span>
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Checkpoint note (e.g. Table 1 completed)..."
                      value={checkpointNote}
                      onChange={(e) => setCheckpointNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateCheckpoint();
                        if (e.key === "Escape") setShowCheckpointInput(false);
                      }}
                      className="w-56 sm:w-64 px-2.5 py-1 text-xs rounded-xl border border-primary bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <Button
                      size="xs"
                      onClick={handleCreateCheckpoint}
                      disabled={isCreatingCheckpoint}
                      className="h-7 px-2.5 text-xs rounded-lg cursor-pointer"
                    >
                      Save
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setShowCheckpointInput(false)}
                      className="h-7 px-2 text-xs rounded-lg cursor-pointer"
                    >
                      ✕
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Filter Toggle */}
            <button
              onClick={() => setFilterMilestonesOnly(!filterMilestonesOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                filterMilestonesOnly
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border-border/70"
              }`}
            >
              <Filter className="size-3" />
              <span>{filterMilestonesOnly ? "Submissions Only" : "All Revisions"}</span>
            </button>

            {/* Close Studio Button */}
            <button
              onClick={onClose}
              className="size-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer ml-1"
              title="Close Version Studio (Esc)"
            >
              <X className="size-4.5" />
            </button>
          </div>
        </header>

        {/* ==================== 2. MAIN 2-PANE BODY ==================== */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden select-text">
          
          {/* ==================== LEFT PANE: TRUE DOCUMENT PREVIEW (68%) ==================== */}
          <section className="lg:col-span-8 flex flex-col min-h-0 bg-muted/15 border-r border-border/70 overflow-hidden relative">
            
            {/* Preview Banner Header */}
            <div className="px-6 py-3 border-b border-border/60 bg-background/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5">
                {isViewingDraft ? (
                  <>
                    <span className="px-2.5 py-1 rounded-xl font-mono text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                      <Sparkles className="size-3.5 animate-pulse" />
                      Active Draft
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      Live Workspace State (Uncommitted)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="px-2.5 py-1 rounded-xl font-mono text-xs font-black bg-primary/10 text-primary border border-primary/20">
                      Rev #{selectedRevNumber}
                    </span>

                    {selectedMeta?.status === "late_submitted" || (selectedMeta?.status === "submitted" && selectedMeta?.isLate) ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                        Late Submission
                      </span>
                    ) : selectedMeta?.status === "submitted" || selectedMeta?.trigger === "submit" || selectedMeta?.trigger === "submission" ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        Submitted Milestone
                      </span>
                    ) : selectedMeta?.status === "revoked" || selectedMeta?.remarks?.toLowerCase().includes("revoked") ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        Revoked Prior to Deadline
                      </span>
                    ) : selectedMeta?.status === "changes_requested" ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                        Teacher Requested Changes
                      </span>
                    ) : selectedMeta?.status === "past_submitted" ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30">
                        Superseded Past Submission
                      </span>
                    ) : selectedMeta?.status === "approved" ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30">
                        Approved & Graded
                      </span>
                    ) : selectedMeta?.remarks?.toLowerCase().includes("restored") || selectedMeta?.trigger === "restore" ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                        <RotateCcw className="size-3" /> Restored Milestone
                      </span>
                    ) : selectedMeta?.remarks?.toLowerCase().includes("checkpoint") || selectedMeta?.trigger === "checkpoint" ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center gap-1">
                        <BookmarkPlus className="size-3" /> Checkpoint
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-muted text-muted-foreground border border-border/60">
                        Historical Snapshot
                      </span>
                    )}

                    {/* Changed Blocks Metadata Badge */}
                    {selectedMeta?.changedBlockIds && selectedMeta.changedBlockIds.length > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        +{selectedMeta.changedBlockIds.length} delta block{selectedMeta.changedBlockIds.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {selectedMeta?.structureChanged && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        Structural reorder
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Timestamp info */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <Clock className="size-3.5" />
                <span>
                  {isViewingDraft
                    ? "Live / Current"
                    : selectedMeta?.createdAt
                    ? `${new Date(selectedMeta.createdAt).toLocaleDateString()} at ${new Date(
                        selectedMeta.createdAt
                      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : "—"}
                </span>
              </div>
            </div>

            {/* Scrollable Paper Canvas Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex justify-center bg-slate-100/50 dark:bg-black/40">
              {isLoadingReconstruction ? (
                <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 border border-border/60 rounded-2xl p-8 sm:p-12 shadow-xl flex flex-col items-center justify-center gap-4 min-h-[500px]">
                  <Loader2 className="size-8 text-primary animate-spin" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-foreground">Reconstructing Revision #{selectedRevNumber}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Resolving block deltas and assembling document structure...
                    </p>
                  </div>
                </div>
              ) : isReconstructionError ? (
                <div className="w-full max-w-3xl bg-rose-500/5 border border-rose-500/30 rounded-2xl p-8 shadow-xl flex flex-col items-center justify-center text-center gap-3 min-h-[400px]">
                  <AlertCircle className="size-8 text-rose-500" />
                  <p className="text-sm font-bold text-foreground">Unable to load revision blocks</p>
                  <p className="text-xs text-muted-foreground max-w-md">
                    The requested revision record could not be fetched from the server. Please try selecting another revision.
                  </p>
                </div>
              ) : (
                /* Actual Paper Document Canvas */
                <article className="w-full max-w-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-2xl rounded-2xl p-6 sm:p-10 md:p-12 flex flex-col gap-6 min-h-[700px] h-fit transition-all">
                  
                  {/* Academic Document Header for this Revision */}
                  <header className="border-b-2 border-primary/20 pb-4 mb-2 select-none">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary/70">
                          LABORATORY EXPERIMENT RECORD • {isViewingDraft ? "ACTIVE DRAFT" : "HISTORICAL ARCHIVE"}
                        </span>
                        <h1 className="text-2xl font-black text-foreground mt-1 tracking-tight">
                          {displayTitle}
                        </h1>
                      </div>
                      <div className="px-3 py-1 rounded-xl bg-muted/60 border border-border/60 font-mono text-[11px] font-bold text-muted-foreground shrink-0 text-right">
                        {isViewingDraft ? "Draft" : `Rev #${selectedRevNumber}`}
                      </div>
                    </div>

                    {selectedMeta?.remarks && (
                      <div className="mt-3 p-2.5 rounded-xl bg-muted/40 border border-border/50 text-xs font-mono text-muted-foreground/90">
                        <strong className="text-foreground font-semibold">Remarks: </strong>
                        {selectedMeta.remarks}
                      </div>
                    )}
                  </header>

                  {/* Rendered Block Sequence */}
                  {displayBlocks.length > 0 ? (
                    <div className="flex flex-col gap-5 w-full">
                      {displayBlocks.map((block: any, idx: number) => (
                        <div
                          key={block.id || idx}
                          className="relative group/rendered rounded-lg transition-colors"
                        >
                          <BlockRenderer
                            id={block.id || `b-${idx}`}
                            type={block.type || "paragraph"}
                            content={block.content || {}}
                            previewMode={true}
                            allBlocks={displayBlocks}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-16 text-center flex flex-col items-center justify-center gap-3 border border-dashed border-border/70 rounded-2xl my-8">
                      <Layers className="size-8 text-muted-foreground/40" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Initial Document Template
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          No content blocks recorded for this revision snapshot.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Document Footer Watermark */}
                  <footer className="mt-12 pt-4 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground/70 font-mono select-none">
                    <span>eJournal Document Management System</span>
                    <span>{isViewingDraft ? "Active Draft" : `Snapshot Rev #${selectedRevNumber}`} • {displayBlocks.length} Block(s)</span>
                  </footer>
                </article>
              )}
            </div>
          </section>

          {/* ==================== RIGHT PANE: TIMELINE FEED (32%) ==================== */}
          <aside className="lg:col-span-4 flex flex-col min-h-0 bg-background/90 select-none overflow-hidden">
            
            {/* Timeline Pane Header */}
            <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between shrink-0 bg-muted/10">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <span className="text-xs font-bold text-foreground">Timeline History</span>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                {displayedVersions.length + (showActiveDraftNode ? 1 : 0)} record{displayedVersions.length + (showActiveDraftNode ? 1 : 0) === 1 ? "" : "s"}
              </span>
            </div>

            {/* Git-Style Connected Timeline Feed */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div className="relative pl-6 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-border/70">
                {/* 1. Topmost Timeline Node: Active Working Draft (Only when draft or changes_requested) */}
                {showActiveDraftNode && (
                  <div
                    onClick={() => setSelectedRevNumber(0)}
                    className={`group relative mb-3.5 rounded-2xl border p-3.5 transition-all cursor-pointer ${
                      selectedRevNumber === 0
                        ? "bg-primary/10 border-primary shadow-sm ring-2 ring-primary/30"
                        : "bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50"
                    }`}
                  >
                    <span
                      className={`absolute -left-[27px] top-4.5 size-3.5 rounded-full border-2 bg-background transition-transform ${
                        selectedRevNumber === 0
                          ? "border-emerald-500 bg-emerald-500 scale-110 shadow-xs"
                          : "border-emerald-500/80 bg-emerald-500/20"
                      }`}
                    />
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-black text-foreground font-mono">
                          Active Working Draft
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        Live
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-sans leading-tight">
                      Live workspace edits in memory. Silently auto-persisted.
                    </p>
                    <div className="flex items-center gap-2 pt-1.5 text-[10px] text-muted-foreground font-mono">
                      <span>{(activeBlocks || []).length} current blocks</span>
                      <span>•</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Uncommitted</span>
                    </div>
                  </div>
                )}

                {displayedVersions.map((ver) => {
                  const isSelected = !isViewingDraft && ver.revisionNumber === selectedRevNumber;
                  const isHighlighted = highlightedRevNumber === ver.revisionNumber;
                  const isLate = ver.status === "late_submitted" || ((ver.status === "submitted" || ver.trigger === "submit" || ver.trigger === "submission") && ver.isLate);
                  const isSubmitted = (ver.status === "submitted" || ver.trigger === "submit" || ver.trigger === "submission") && !isLate;
                  const isRevoked = ver.status === "revoked" || ver.remarks?.toLowerCase().includes("revoked") || ver.isRevoked;
                  const isChangesReq = ver.status === "changes_requested";
                  const isPastSub = ver.status === "past_submitted" || ver.isPastSubmission;
                  const isApproved = ver.status === "approved";
                  const isRestored = ver.remarks?.toLowerCase().includes("restored") || ver.trigger === "restore";
                  const isCheckpoint = ver.remarks?.toLowerCase().includes("checkpoint") || ver.trigger === "checkpoint" || ver.trigger === "manual_checkpoint";

                  return (
                    <div
                      key={ver.id || ver.revisionNumber}
                      onClick={() => setSelectedRevNumber(ver.revisionNumber)}
                      className={`group relative mb-3.5 rounded-2xl border p-3.5 transition-all cursor-pointer ${
                        isHighlighted
                          ? "ring-2 ring-amber-500 bg-amber-500/15 border-amber-500/80 shadow-md animate-pulse"
                          : isSelected
                          ? "bg-primary/10 border-primary shadow-sm ring-2 ring-primary/30"
                          : isLate
                          ? "bg-rose-500/5 border-rose-500/30 hover:border-rose-500/50"
                          : isSubmitted
                          ? "bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50"
                          : isRevoked
                          ? "bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50"
                          : isChangesReq
                          ? "bg-rose-500/5 border-rose-500/30 hover:border-rose-500/50"
                          : isPastSub
                          ? "bg-slate-500/5 border-slate-500/20 hover:border-slate-500/40"
                          : "bg-muted/20 border-border/60 hover:border-border/90 hover:bg-muted/40"
                      }`}
                    >
                      {/* Connected Node Indicator on Vertical Rail */}
                      <span
                        className={`absolute -left-[27px] top-4.5 size-3.5 rounded-full border-2 bg-background transition-transform ${
                          isHighlighted
                            ? "border-amber-500 bg-amber-500 scale-125 shadow-xs"
                            : isSelected
                            ? "border-primary bg-primary scale-110 shadow-xs"
                            : isLate
                            ? "border-rose-500 bg-rose-500"
                            : isSubmitted
                            ? "border-emerald-500 bg-emerald-500"
                            : isRevoked
                            ? "border-amber-500 bg-amber-500"
                            : isChangesReq
                            ? "border-rose-500 bg-rose-500"
                            : isPastSub
                            ? "border-slate-400 bg-slate-400"
                            : isApproved
                            ? "border-violet-500 bg-violet-500"
                            : isRestored
                            ? "border-indigo-500 bg-indigo-500"
                            : isCheckpoint
                            ? "border-purple-500 bg-purple-500"
                            : "border-muted-foreground/60 bg-muted"
                        }`}
                      />

                      {/* Revision Number and Badges */}
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <GitCommit
                            className={`size-3.5 ${
                              isLate
                                ? "text-rose-500"
                                : isSubmitted
                                ? "text-emerald-500"
                                : isRevoked
                                ? "text-amber-500"
                                : isChangesReq
                                ? "text-rose-500"
                                : isPastSub
                                ? "text-slate-400"
                                : isApproved
                                ? "text-violet-500"
                                : isRestored
                                ? "text-indigo-500"
                                : isCheckpoint
                                ? "text-purple-500"
                                : "text-muted-foreground"
                            }`}
                          />
                          <span className="text-xs font-black text-foreground font-mono">
                            Revision #{ver.revisionNumber}
                          </span>
                        </div>

                        {isLate ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            Late Submission
                          </span>
                        ) : isSubmitted ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            Submitted
                          </span>
                        ) : isRevoked ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            Revoked
                          </span>
                        ) : isChangesReq ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            Changes Req.
                          </span>
                        ) : isPastSub ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30">
                            Past Submission
                          </span>
                        ) : isApproved ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30">
                            Approved
                          </span>
                        ) : isRestored ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                            Restored
                          </span>
                        ) : isCheckpoint ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                            Bookmark
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase">
                            Snapshot
                          </span>
                        )}
                      </div>

                      {/* Timestamp & Trigger */}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {new Date(ver.createdAt).toLocaleDateString()}{" "}
                          {new Date(ver.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="capitalize text-[10px] font-semibold text-foreground/80">
                          {ver.trigger || ver.status}
                        </span>
                      </div>

                      {/* Remarks */}
                      {ver.remarks && (
                        <p className="text-[11px] text-muted-foreground bg-background/60 p-2 rounded-xl border border-border/40 font-mono leading-tight mb-1.5">
                          {ver.remarks}
                        </p>
                      )}

                      {/* Block Metrics Summary Pill */}
                      <div className="flex items-center gap-2 pt-1 text-[10px] text-muted-foreground font-mono">
                        <span>
                          {ver.blockOrder
                            ? `${ver.blockOrder.length} blocks`
                            : ver.blocks
                            ? `${ver.blocks.length} blocks`
                            : "Blocks recorded"}
                        </span>
                        {ver.changedBlockIds && ver.changedBlockIds.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-amber-500 font-bold">
                              {ver.changedBlockIds.length} delta(s)
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>

        {/* ==================== 3. STICKY BOTTOM RESTORE BAR ==================== */}
        <footer className="px-6 py-3.5 border-t border-border/70 bg-background/95 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
          
          {/* Status and Invariant Notice */}
          <div className="flex items-center gap-2 text-xs">
            {isViewingDraft ? (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>You are currently previewing your uncommitted active working draft.</span>
              </div>
            ) : isLockedState ? (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
                <ShieldAlert className="size-4 shrink-0 text-amber-500" />
                <span>🔒 Document is handed in and locked. Unsubmit this journal to restore or edit past revisions.</span>
              </div>
            ) : isSelectedIdenticalToDraft ? (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
                <CheckCircle2 className="size-4 shrink-0 text-amber-500" />
                <span>Document draft workspace is already identical to Revision #{selectedRevNumber}.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldAlert className="size-4 text-indigo-500 shrink-0" />
                <span>
                  Restoring <strong className="text-foreground">Revision #{selectedRevNumber}</strong>{" "}
                  loads its content into your draft workspace for editing.
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Return to Editor
            </Button>

            {/* Restore and Direct Submit Buttons (Student only, when previewing historical rev) */}
            {!isViewingDraft && canRestore && (
              <>
                {/* 1. Restore as Draft */}
                {!showConfirmRestore && !showConfirmSubmit ? (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setShowConfirmRestore(true)}
                      disabled={isRestoring || isSubmittingVersion || isSelectedIdenticalToDraft}
                      className={`h-9 px-4 text-xs font-bold rounded-xl gap-2 transition-all ${
                        isSelectedIdenticalToDraft
                          ? "bg-muted text-muted-foreground border border-border/70 cursor-not-allowed opacity-60"
                          : "glass-btn-indigo-solid !text-white shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/35 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                      }`}
                      title={isSelectedIdenticalToDraft ? "Document draft is already identical to this revision" : "Restore revision to draft workspace"}
                    >
                      <RotateCcw className="size-3.5" />
                      <span>
                        {isSelectedIdenticalToDraft ? "Already in Draft" : "Restore as Draft"}
                      </span>
                    </Button>

                    {onSubmitVersion && (
                      <Button
                        size="sm"
                        onClick={() => setShowConfirmSubmit(true)}
                        disabled={isRestoring || isSubmittingVersion}
                        className="h-9 px-4 text-xs font-bold rounded-xl gap-2 glass-btn-emerald !text-white shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                        title="Directly submit Revision #{selectedRevNumber} as a new submission without re-typing"
                      >
                        <CheckCircle2 className="size-3.5 !text-white" />
                        <span className="!text-white">Submit this Version</span>
                      </Button>
                    )}
                  </div>
                ) : showConfirmRestore ? (
                  <div className="flex items-center gap-2 animate-in fade-in duration-150">
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Restore Rev #{selectedRevNumber} into your draft workspace?
                    </span>
                    <Button
                      size="sm"
                      onClick={handleExecuteRestore}
                      disabled={isRestoring}
                      className="h-8 px-3.5 text-xs font-bold rounded-xl gap-1.5 glass-btn-destructive-solid !text-white shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                    >
                      {isRestoring ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin !text-white" />
                          <span className="!text-white">Restoring...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-3.5 !text-white" />
                          <span className="!text-white">Yes, Restore to Draft</span>
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowConfirmRestore(false)}
                      className="h-8 px-2.5 text-xs rounded-xl cursor-pointer"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 animate-in fade-in duration-150">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Submit Rev #{selectedRevNumber} directly to your teacher?
                    </span>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (onSubmitVersion) {
                          onSubmitVersion(selectedRevNumber);
                          setShowConfirmSubmit(false);
                        }
                      }}
                      disabled={isSubmittingVersion}
                      className="h-8 px-3.5 text-xs font-bold rounded-xl gap-1.5 glass-btn-emerald !text-white shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                    >
                      {isSubmittingVersion ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin !text-white" />
                          <span className="!text-white">Submitting...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-3.5 !text-white" />
                          <span className="!text-white">Yes, Submit Now</span>
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowConfirmSubmit(false)}
                      className="h-8 px-2.5 text-xs rounded-xl cursor-pointer"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </footer>

      </div>
    </div>
  );
}
