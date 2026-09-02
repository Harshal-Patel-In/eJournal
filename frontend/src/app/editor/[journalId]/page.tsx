"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Loader2, Plus, MessageSquare, History, CheckCircle2, Sparkles, AlertTriangle } from "lucide-react";

import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { useDocumentStore, getLocalSnapshot, clearLocalSnapshot } from "./use-document-store";
import EditorToolbar from "./editor-toolbar";
import BlockWrapper from "./block-wrapper";
import BlockRenderer from "./block-renderer";
import FloatingToolbox from "./floating-toolbox";
import ConflictDialog from "./conflict-dialog";
import ReviewDrawer from "./review-drawer";
import { SubmitDialog } from "./submit-dialog";
import { AnnotationToolbar, AnnotationType } from "@/components/editor/annotation-toolbar";
import BlockAnnotations, { getDominantBorderColor } from "@/components/editor/block-annotations";
import { VersionHistoryDrawer } from "@/components/editor/version-history-drawer";

interface PageProps {
  params: Promise<{ journalId: string }>;
}

export default function EditorPage({ params }: PageProps) {
  const { journalId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentIdParam = searchParams.get("assignmentId");
  const queryClient = useQueryClient();

  const [mounted, setMounted] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [showReviewDrawer, setShowReviewDrawer] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showVersionDrawer, setShowVersionDrawer] = useState(false);
  const [activeAnnotationBlockId, setActiveAnnotationBlockId] = useState<string | null>(null);
  const [localRecoverySnapshot, setLocalRecoverySnapshot] = useState<any>(null);

  // Handle auto-initialization for /editor/new?assignmentId=...
  const createJournalMutation = useMutation({
    mutationFn: (asgId: string) => api.post<any>("/journals", { assignmentId: asgId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["student-journals"] });
      router.replace(`/editor/${data.id}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to initialize journal workspace");
    },
  });

  useEffect(() => {
    if (
      journalId === "new" &&
      assignmentIdParam &&
      !createJournalMutation.isPending &&
      !createJournalMutation.isSuccess
    ) {
      createJournalMutation.mutate(assignmentIdParam);
    }
  }, [journalId, assignmentIdParam]);

  const {
    blocks,
    title,
    status,
    isDirty,
    isSaving,
    syncStatus,
    clientRevision,
    previewMode,
    init,
    moveBlock,
    addBlock,
    setSaving,
    setDirty,
    setSyncStatus,
    setRevision,
    togglePreview,
    loadLocalRecovery,
  } = useDocumentStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Fetch User Profile
  const { data: user, isLoading: userLoading } = useQuery<any>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile"),
  });

  // 2. Fetch Journal Details (only if not 'new')
  const { data: journal, isLoading: journalLoading, error: journalError, refetch: refetchJournal } = useQuery<any>({
    queryKey: ["journal", journalId],
    queryFn: () => api.get(`/journals/${journalId}`),
    enabled: journalId !== "new",
    retry: false,
  });

  // 3. Fetch Assignment Details
  const { data: assignment } = useQuery<any>({
    queryKey: ["assignment", journal?.assignmentId],
    queryFn: () => api.get(`/assignments/${journal.assignmentId}`),
    enabled: !!journal?.assignmentId,
  });

  // 4. Fetch Annotations / Comments
  const { data: annotations, refetch: refetchAnnotations } = useQuery<any[]>({
    queryKey: ["annotations", journalId],
    queryFn: () => api.get(`/journals/${journalId}/annotations`),
  });

  // 5. Fetch Versions History
  const { data: versions } = useQuery<any[]>({
    queryKey: ["versions", journalId],
    queryFn: () => api.get(`/journals/${journalId}/versions`),
    enabled: showVersionDrawer,
  });

  // Initialize Zustand Store & Check Local Recovery
  useEffect(() => {
    if (journal) {
      const serverRev = journal.currentVersion || 1;
      init(journal.id, journal.title, journal.blocks, journal.status, serverRev);

      const snapshot = getLocalSnapshot(journal.id);
      if (snapshot && snapshot.savedAt && new Date(snapshot.savedAt) > new Date(journal.updatedAt)) {
        setLocalRecoverySnapshot(snapshot);
      }
    }
  }, [journal, init]);

  // Set default previewMode = true for teachers
  useEffect(() => {
    if (user?.role === "teacher" && !previewMode) {
      togglePreview();
    }
  }, [user, previewMode, togglePreview]);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: (data: { title: string; blocks: any[]; clientRevision: number }) =>
      api.patch(`/journals/${journalId}/blocks`, data),
    onMutate: () => setSaving(true),
    onSuccess: (data: any) => {
      setSaving(false);
      setRevision(data.currentVersion || clientRevision + 1, data.updatedAt);
      setShowConflictDialog(false);
    },
    onError: (err: any) => {
      setSaving(false);
      if (err.status === 409 || err.code === "REVISION_CONFLICT" || err.message?.includes("409")) {
        setSyncStatus("conflict");
        setShowConflictDialog(true);
      } else {
        setSyncStatus("unsaved");
      }
    },
  });

  // Submit Mutation
  const submitMutation = useMutation({
    mutationFn: () => api.post<any>(`/journals/${journalId}/submit`),
    onSuccess: (data) => {
      useDocumentStore.getState().setStatus(data.status);
      setShowSubmitModal(false);
      queryClient.invalidateQueries({ queryKey: ["journal", journalId] });
      toast.success("Journal handed in successfully! It is now locked for review.", { title: "🎉 Handed In" });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to hand in journal.");
    },
  });

  // Unsubmit Mutation
  const unsubmitMutation = useMutation({
    mutationFn: () => api.post<any>(`/journals/${journalId}/unsubmit`),
    onSuccess: (data) => {
      useDocumentStore.getState().setStatus(data.status);
      queryClient.invalidateQueries({ queryKey: ["journal", journalId] });
      toast.success("Submission undone successfully! The journal is unlocked for editing.", { title: "↩ Unsubmitted" });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to undo submission.");
    },
  });

  // Create Annotation Mutation
  const addAnnotationMutation = useMutation({
    mutationFn: (data: { blockId: string; type: string; content: string }) =>
      api.post(`/journals/${journalId}/annotations`, data),
    onSuccess: () => {
      refetchAnnotations();
      setActiveAnnotationBlockId(null);
      toast.success("Annotation added to document block.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add annotation.");
    },
  });

  // Apply Teacher Suggestion Mutation
  const applySuggestionMutation = useMutation({
    mutationFn: (commentId: string) => api.post(`/comments/${commentId}/apply-suggestion`),
    onSuccess: () => {
      refetchJournal();
      refetchAnnotations();
      toast.success("Teacher suggestion applied to document block!", { title: "✨ Applied" });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to apply suggestion.");
    },
  });

  // Reply to Question / Comment Thread Mutation
  const replyQuestionMutation = useMutation({
    mutationFn: (data: { blockId: string; parentCommentId: string; message: string }) =>
      api.post(`/comments`, {
        journalId,
        blockId: data.blockId,
        parentCommentId: data.parentCommentId,
        message: data.message,
        content: data.message,
        type: "Comment",
      }),
    onSuccess: () => {
      refetchAnnotations();
      toast.success("Reply posted to thread.", { title: "💬 Replied" });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to post reply.");
    },
  });

  // Resolve / Reject Annotation Mutation
  const resolveAnnotationMutation = useMutation({
    mutationFn: (commentId: string) => api.put(`/comments/${commentId}/resolve`, {}),
    onSuccess: () => {
      refetchAnnotations();
      toast.success("Annotation thread resolved.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to resolve annotation.");
    },
  });

  // Restore Version Mutation
  const restoreVersionMutation = useMutation({
    mutationFn: (revisionNumber: number) =>
      api.post(`/journals/${journalId}/versions/${revisionNumber}/restore`),
    onSuccess: (data: any) => {
      if (data) {
        useDocumentStore.getState().init(
          data.id,
          data.title,
          data.blocks || [],
          data.status,
          data.currentVersion || clientRevision + 1
        );
      }
      refetchJournal();
      queryClient.invalidateQueries({ queryKey: ["versions", journalId] });
      setShowVersionDrawer(false);
      toast.success("Document restored to specified revision snapshot!", { title: "↺ Restored" });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to restore version snapshot.");
    },
  });

  // Auto-Save Debounce
  useEffect(() => {
    if (!isDirty || isSaving || previewMode || !title || syncStatus === "conflict" || syncStatus === "offline") return;
    const timer = setTimeout(() => {
      saveMutation.mutate({ title, blocks, clientRevision });
    }, 2500);
    return () => clearTimeout(timer);
  }, [title, blocks, isDirty, isSaving, previewMode, clientRevision, syncStatus, saveMutation]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    moveBlock(result.source.index, result.destination.index);
  };

  if (
    !mounted ||
    userLoading ||
    (journalId !== "new" && journalLoading) ||
    (journalId === "new" && createJournalMutation.isPending)
  ) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground animate-pulse">
          {journalId === "new" ? "Initializing Document Workspace..." : "Loading Visual Workspace..."}
        </p>
      </div>
    );
  }

  if (journalError || (!journal && journalId !== "new")) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <div className="p-8 max-w-md w-full rounded-3xl glass-card border border-border/80 flex flex-col items-center gap-4">
          <div className="size-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertTriangle className="size-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Journal Not Found</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This journal could not be found or you do not have permission to view it.
          </p>
          <Button
            onClick={() => router.push("/dashboard")}
            className="rounded-xl px-5 text-xs font-semibold cursor-pointer"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const classroomId = assignment?.classroomId || "";
  const isEditable = (status === "draft" || status === "changes_requested") && user?.role === "student";
  const isTeacher = user?.role === "teacher";

  return (
    <div className="flex min-h-screen flex-col bg-slate-100/70 dark:bg-zinc-950 bg-textured-workspace text-foreground selection:bg-primary/10 relative">
      {/* Editor Header Toolbar */}
      <EditorToolbar
        classroomId={classroomId}
        onSave={() => saveMutation.mutate({ title, blocks, clientRevision })}
        onSubmit={() => setShowSubmitModal(true)}
        isSubmitting={submitMutation.isPending}
        onUnsubmit={() => unsubmitMutation.mutate()}
        isUnsubmitting={unsubmitMutation.isPending}
        onToggleVersionHistory={() => setShowVersionDrawer(true)}
        onToggleReviewDrawer={() => setShowReviewDrawer(!showReviewDrawer)}
        showReviewDrawer={showReviewDrawer}
        userRole={user?.role}
      />

      {/* Conflict Modal */}
      <ConflictDialog
        isOpen={showConflictDialog}
        onReloadServer={async () => {
          clearLocalSnapshot(journalId);
          await refetchJournal();
          setShowConflictDialog(false);
          setSyncStatus("synced");
        }}
        onForceSaveLocal={() => {
          if (journal?.currentVersion) {
            saveMutation.mutate({ title, blocks, clientRevision: journal.currentVersion });
          }
        }}
        isSaving={saveMutation.isPending}
      />

      {/* Pre-submission Checklist Modal */}
      <SubmitDialog
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={() => submitMutation.mutate()}
        isSubmitting={submitMutation.isPending}
        journalTitle={title}
        deadline={assignment?.deadline}
        isLate={journal?.isLate}
      />

      {/* Version History Drawer */}
      <VersionHistoryDrawer
        isOpen={showVersionDrawer}
        onClose={() => setShowVersionDrawer(false)}
        versions={versions || []}
        currentVersion={clientRevision}
        onRestoreVersion={(rev) => restoreVersionMutation.mutate(rev)}
        isRestoring={restoreVersionMutation.isPending}
        userRole={user?.role}
        journalStatus={status}
      />

      <div className="flex-1 flex w-full relative pt-16 print:pt-0">
        {/* Floating Toolbox (Students Only) */}
        {!isTeacher && !previewMode && <FloatingToolbox />}

        {/* Editor Main Canvas Wrapper */}
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:pl-20 xl:pl-24 py-8 flex flex-col gap-6 relative z-10 print:p-0 print:m-0 print:max-w-none print:w-full">
          {/* Academic Print-Only Single Journal Header */}
          <div className="hidden print:flex flex-col border-b-2 border-black pb-4 mb-4 select-none">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">
                  LABORATORY EXPERIMENT RECORD
                </span>
                <h1 className="text-xl font-black text-black mt-0.5">{assignment?.title || title}</h1>
                {assignment?.aim && (
                  <p className="text-xs text-zinc-700 mt-1">
                    <span className="font-bold">Aim: </span>{assignment.aim}
                  </p>
                )}
              </div>
              {journal?.marks !== undefined && journal?.marks !== null && (
                <div className="text-right border-2 border-black px-3 py-1.5 rounded-sm">
                  <div className="text-[10px] font-bold uppercase text-zinc-600">Grade Awarded</div>
                  <div className="text-sm font-mono font-black text-black">
                    {journal.marks} / {assignment?.maxMarks || 10}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-600 border-t border-zinc-200 mt-3 pt-2">
              <span>Student: <strong>{user?.fullName || "Student"}</strong></span>
              <span>•</span>
              <span>Roll No: <strong>{user?.rollNumber || "—"}</strong></span>
              <span>•</span>
              <span>Date: <strong>{new Date().toLocaleDateString()}</strong></span>
            </div>
          </div>

          {/* Local Recovery Banner */}
          {localRecoverySnapshot && isEditable && (
            <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="text-sm font-bold text-foreground">💾 Unsaved Offline Draft Recovered</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => clearLocalSnapshot(journalId)}>Discard</Button>
                <Button size="sm" onClick={() => loadLocalRecovery(localRecoverySnapshot.title, localRecoverySnapshot.blocks)}>Restore</Button>
              </div>
            </div>
          )}

          {/* Approved & Graded Executive Evaluation Liquid Glass Card */}
          {status === "approved" ? (
            <div className="p-5 sm:px-6 rounded-2xl border border-border/50 bg-background/80 dark:bg-zinc-900/80 backdrop-blur-xl shadow-md flex flex-col gap-4 select-none transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold shrink-0">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground tracking-tight">
                        Approved & Graded
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Passed
                      </span>
                    </div>
                    {journal?.approvedAt && (
                      <span className="text-[11px] text-muted-foreground/80 font-medium">
                        Evaluated on {new Date(journal.approvedAt).toLocaleDateString()} at {new Date(journal.approvedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </div>

                {journal?.marks !== undefined && journal?.marks !== null && (
                  <div className="flex items-center gap-2 bg-muted/40 border border-border/50 px-3 py-1.5 rounded-xl shrink-0 self-start sm:self-auto">
                    <Sparkles className="size-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-muted-foreground">Grade:</span>
                    <span className="text-sm font-black text-foreground tabular-nums">
                      {journal.marks} / {assignment?.maxMarks || 10}
                    </span>
                    <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md ml-0.5 border border-emerald-500/20">
                      {Math.round((journal.marks / (assignment?.maxMarks || 10)) * 100)}%
                    </span>
                  </div>
                )}
              </div>

              {journal?.teacherRemarks && (
                <div className="flex items-start gap-2 text-xs">
                  <span className="font-bold text-muted-foreground shrink-0 mt-0.5">Teacher Remarks:</span>
                  <p className="text-foreground/90 font-medium italic leading-relaxed">
                    "{journal.teacherRemarks}"
                  </p>
                </div>
              )}

              {/* Interactive Annotation Jump Buttons */}
              {annotations && annotations.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-xs">
                  <span className="text-[11px] font-bold text-muted-foreground mr-1">
                    Feedback Items ({annotations.length}):
                  </span>
                  {Object.entries(
                    annotations.reduce((acc: Record<string, number>, a: any) => {
                      const t = a.type || "Comment";
                      acc[t] = (acc[t] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([type, count]) => {
                    const typeIcons: Record<string, string> = {
                      Comment: "💬",
                      Suggestion: "✨",
                      Highlight: "🖍",
                      Warning: "⚠️",
                      Approval: "✅",
                      Question: "❓",
                    };
                    const num = Number(count);
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          const target = annotations.find((a: any) => (a.type || "Comment") === type);
                          if (target?.blockId) {
                            setActiveAnnotationBlockId(target.blockId);
                            setShowReviewDrawer(true);
                            const el = document.getElementById(`block-${target.blockId}`) || document.getElementById(target.blockId);
                            if (el) {
                              el.scrollIntoView({ behavior: "smooth", block: "center" });
                              el.classList.add("ring-2", "ring-indigo-500", "ring-offset-4");
                              setTimeout(() => {
                                el.classList.remove("ring-2", "ring-indigo-500", "ring-offset-4");
                              }, 2500);
                            }
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted/50 hover:bg-muted text-foreground border border-border/50 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        title={`Click to jump to ${type} annotation in document`}
                      >
                        <span>{typeIcons[type] || "💬"}</span>
                        <span>{num} {type}{num > 1 ? "s" : ""}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (status === "submitted" || journal?.isRevoked) && (
            <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-foreground flex items-center gap-2">
                  🔒 {journal?.isRevoked ? "Submission Revoked" : "Handed In"}
                  {journal?.isRevoked && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700">
                      Draft Revoked
                    </span>
                  )}
                </span>
                <p className="text-xs text-muted-foreground">
                  {journal?.isRevoked
                    ? "The student unsubmitted this journal to draft status. Teacher grading is locked until resubmitted."
                    : "Handed in for evaluation. Student can unsubmit before deadline."}
                </p>
              </div>
              {status === "submitted" && !isTeacher && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => unsubmitMutation.mutate()}
                  disabled={unsubmitMutation.isPending}
                  className="text-xs font-semibold text-rose-600 border-rose-200"
                >
                  Undo Hand In
                </Button>
              )}
            </div>
          )}

          {/* Paper Sheet Document Canvas Container */}
          <div className="w-full bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 shadow-2xl rounded-2xl p-6 sm:p-10 md:p-12 min-h-[850px] flex flex-col gap-6">
            {!previewMode && (
              <div className="p-3 border border-dashed border-border/80 rounded-xl bg-muted/20 text-xs text-muted-foreground flex justify-between items-center select-none">
                <span><strong>Practical:</strong> Experiment {assignment?.experimentNumber || 1}</span>
                <span className="font-semibold text-primary/70">Block-based Structure Active</span>
              </div>
            )}

            {/* Document Blocks List */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="journal-blocks">
                {(providedDroppable) => (
                  <div
                    ref={providedDroppable.innerRef}
                    {...providedDroppable.droppableProps}
                    className="flex flex-col gap-4 w-full select-text"
                  >
                    {blocks.map((block, idx) => {
                      const blockAnns = annotations?.filter((a) => a.blockId === block.id) || [];
                      const hasAnnotations = blockAnns.length > 0;
                      const borderAccent = hasAnnotations ? getDominantBorderColor(blockAnns) : "";

                      return (
                        <Draggable
                          key={block.id}
                          draggableId={block.id}
                          index={idx}
                          isDragDisabled={previewMode || isTeacher || !isEditable}
                        >
                          {(providedDraggable) => (
                            <div
                              className={`flex flex-col relative group/block rounded-lg transition-all ${
                                hasAnnotations
                                  ? `border-l-[3px] ${borderAccent} pl-3`
                                  : ""
                              }`}
                            >
                              <BlockWrapper
                                id={block.id}
                                index={idx}
                                provided={providedDraggable}
                                previewMode={previewMode || isTeacher || !isEditable}
                              >
                                <BlockRenderer
                                  id={block.id}
                                  type={block.type}
                                  content={block.content}
                                  previewMode={previewMode || isTeacher}
                                />
                              </BlockWrapper>

                              {/* Teacher: Hover-Only Annotation Trigger */}
                              {isTeacher && (
                                <div className="mt-1">
                                  <button
                                    onClick={() =>
                                      setActiveAnnotationBlockId(
                                        activeAnnotationBlockId === block.id ? null : block.id
                                      )
                                    }
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                                      activeAnnotationBlockId === block.id
                                        ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                                        : "text-muted-foreground/0 group-hover/block:text-muted-foreground/60 hover:!text-indigo-500 hover:!bg-indigo-500/5"
                                    }`}
                                  >
                                    <MessageSquare className="size-3" />
                                    <span>Annotate</span>
                                    {hasAnnotations && (
                                      <span className="ml-1 size-4 rounded-full bg-indigo-500/15 text-indigo-500 text-[9px] font-black flex items-center justify-center">
                                        {blockAnns.length}
                                      </span>
                                    )}
                                  </button>

                                  {activeAnnotationBlockId === block.id && (
                                    <div className="mt-1.5">
                                      <AnnotationToolbar
                                        blockId={block.id}
                                        onAddAnnotation={(type, content) =>
                                          addAnnotationMutation.mutate({ blockId: block.id, type, content })
                                        }
                                        isSubmitting={addAnnotationMutation.isPending}
                                        onClose={() => setActiveAnnotationBlockId(null)}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Collapsible Annotation Thread */}
                              <BlockAnnotations
                                annotations={blockAnns}
                                isTeacher={isTeacher}
                                currentUser={user}
                                onApplySuggestion={(commentId) => applySuggestionMutation.mutate(commentId)}
                                onReplyQuestion={(annotationId, replyText) =>
                                  replyQuestionMutation.mutate({
                                    blockId: block.id,
                                    parentCommentId: annotationId,
                                    message: replyText,
                                  })
                                }
                                onRejectSuggestion={(commentId) => resolveAnnotationMutation.mutate(commentId)}
                                onResolveAnnotation={(commentId) => resolveAnnotationMutation.mutate(commentId)}
                              />
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {providedDroppable.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {!previewMode && isEditable && (
              <div className="pt-6 border-t border-border/40 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addBlock(blocks.length, "paragraph")}
                  className="gap-2 text-xs font-semibold rounded-xl text-muted-foreground border-dashed"
                >
                  <Plus className="size-3.5" />
                  <span>Add Paragraph Block</span>
                </Button>
              </div>
            )}
          </div>
        </main>

        {/* Teacher Review Panel — Floating Right Sidebar */}
        {isTeacher && showReviewDrawer && (
          <aside className="w-[340px] shrink-0 sticky top-[4.5rem] h-[calc(100vh-5.5rem)] mr-3 my-2 rounded-2xl bg-gradient-to-b from-white/95 via-white/90 to-white/85 dark:from-zinc-900/95 dark:via-zinc-900/90 dark:to-zinc-950/85 backdrop-blur-2xl backdrop-saturate-150 border border-white/80 dark:border-white/10 ring-1 ring-black/5 dark:ring-white/10 shadow-xl z-20 overflow-hidden">
            <ReviewDrawer
              journalId={journalId}
              classroomId={classroomId}
              journalStatus={status}
              assignment={assignment}
              studentId={journal?.studentId}
              maxMarks={assignment?.maxMarks || 10}
              currentMarks={journal?.marks}
              currentRemarks={journal?.teacherRemarks}
              onClose={() => setShowReviewDrawer(false)}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
