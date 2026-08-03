"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Loader2, Plus, Sparkles } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useDocumentStore, getLocalSnapshot, clearLocalSnapshot } from "./use-document-store";
import EditorToolbar from "./editor-toolbar";
import BlockWrapper from "./block-wrapper";
import BlockRenderer from "./block-renderer";
import FloatingToolbox from "./floating-toolbox";
import ConflictDialog from "./conflict-dialog";
import ReviewDrawer from "./review-drawer";

interface PageProps {
  params: Promise<{ journalId: string }>;
}

export default function EditorPage({ params }: PageProps) {
  const { journalId } = use(params);
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [showReviewDrawer, setShowReviewDrawer] = useState(true);
  const [localRecoverySnapshot, setLocalRecoverySnapshot] = useState<any>(null);


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
    loadLocalRecovery,
  } = useDocumentStore();

  // 1. Avoid Next.js hydration mismatches for browser-specific dnd engine
  useEffect(() => {
    setMounted(true);
  }, []);

  // 2. Fetch User Profile
  const { data: user, isLoading: userLoading } = useQuery<any>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile"),
  });

  // 3. Fetch Journal Details
  const { data: journal, isLoading: journalLoading, error: journalError, refetch: refetchJournal } = useQuery<any>({
    queryKey: ["journal", journalId],
    queryFn: () => api.get(`/journals/${journalId}`),
    retry: false,
  });

  // 4. Fetch Assignment Details (to get classroomId for back link)
  const { data: assignment } = useQuery<any>({
    queryKey: ["assignment", journal?.assignmentId],
    queryFn: () => api.get(`/assignments/${journal.assignmentId}`),
    enabled: !!journal?.assignmentId,
  });

  // 5. Initialize Zustand Store & Check Local Offline Snapshot Recovery
  useEffect(() => {
    if (journal) {
      const serverRev = journal.currentVersion || 1;
      init(journal.id, journal.title, journal.blocks, journal.status, serverRev);

      // Check if local recovery snapshot exists and has newer changes
      const snapshot = getLocalSnapshot(journal.id);
      if (snapshot && snapshot.savedAt && new Date(snapshot.savedAt) > new Date(journal.updatedAt)) {
        setLocalRecoverySnapshot(snapshot);
      }
    }
  }, [journal, init]);

  // 5.5 Monitor Online/Offline Status
  useEffect(() => {
    const handleOffline = () => setSyncStatus("offline");
    const handleOnline = () => {
      if (isDirty) setSyncStatus("unsaved");
      else setSyncStatus("synced");
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [isDirty, setSyncStatus]);

  // 6. Save Mutation (PATCH /journals/{id}/blocks with clientRevision)
  const saveMutation = useMutation({
    mutationFn: (data: { title: string; blocks: any[]; clientRevision: number }) =>
      api.patch(`/journals/${journalId}/blocks`, data),
    onMutate: () => {
      setSaving(true);
    },
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
        console.error("Auto-save failed:", err);
      }
    },
  });

  // 6.2 Conflict Resolution Handlers
  const handleReloadServerVersion = async () => {
    clearLocalSnapshot(journalId);
    await refetchJournal();
    setShowConflictDialog(false);
    setSyncStatus("synced");
  };

  const handleForceSaveLocal = () => {
    if (journal?.currentVersion) {
      saveMutation.mutate({
        title,
        blocks,
        clientRevision: journal.currentVersion,
      });
    }
  };

  // 6.5 Submit/Hand-in Mutation (HTTP POST)
  const submitMutation = useMutation({
    mutationFn: () => api.post<any>(`/journals/${journalId}/submit`),
    onSuccess: (data) => {
      useDocumentStore.getState().setStatus(data.status);
      alert("Journal handed in successfully! It is now locked for review.");
    },
    onError: (err: any) => {
      alert(err.message || "Failed to hand in journal.");
    },
  });

  // 6.7 Unsubmit/Undo-Hand-In Mutation (HTTP POST)
  const unsubmitMutation = useMutation({
    mutationFn: () => api.post<any>(`/journals/${journalId}/unsubmit`),
    onSuccess: (data) => {
      useDocumentStore.getState().setStatus(data.status);
      alert("Submission undone successfully! The journal is unlocked for editing.");
    },
    onError: (err: any) => {
      alert(err.message || "Failed to undo submission.");
    },
  });

  // 7. Auto-Save Debounce (triggers after 2.5 seconds of inactivity)
  useEffect(() => {
    if (!isDirty || isSaving || previewMode || !title || syncStatus === "conflict" || syncStatus === "offline") return;

    const timer = setTimeout(() => {
      saveMutation.mutate({ title, blocks, clientRevision });
    }, 2500);

    return () => clearTimeout(timer);
  }, [title, blocks, isDirty, isSaving, previewMode, clientRevision, syncStatus, saveMutation]);

  // 8. Handle Drag End
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    moveBlock(result.source.index, result.destination.index);
  };

  // Redirect to login if user lookup fails
  useEffect(() => {
    if (journalError) {
      router.push("/auth/login");
    }
  }, [journalError, router]);

  if (!mounted || userLoading || journalLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">

        <Loader2 className="size-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading Visual Document Workspace...</p>
      </div>
    );
  }

  if (journalError || !journal) {
    return null;
  }

  const classroomId = assignment?.classroomId || "";
  const isEditable = status === "draft" || status === "changes_requested";

  return (
    <div className="flex min-h-screen flex-col bg-slate-100/70 dark:bg-zinc-950 bg-textured-workspace text-foreground selection:bg-primary/10 relative">
      {/* Editor Header Toolbar */}
      <EditorToolbar
        classroomId={classroomId}
        onSave={() => saveMutation.mutate({ title, blocks, clientRevision })}
        onSubmit={() => submitMutation.mutate()}
        isSubmitting={submitMutation.isPending}
        onUnsubmit={() => unsubmitMutation.mutate()}
        isUnsubmitting={unsubmitMutation.isPending}
      />

      {/* 409 Conflict Dialog Modal */}
      <ConflictDialog
        isOpen={showConflictDialog}
        onReloadServer={handleReloadServerVersion}
        onForceSaveLocal={handleForceSaveLocal}
        isSaving={saveMutation.isPending}
      />

      {/* Persistent Left Floating Toolbox (Blocks & Sections Palette) */}
      <FloatingToolbox />

      {/* Editor Main Canvas Wrapper */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:pl-20 xl:pl-24 pt-20 pb-16 flex flex-col gap-6 relative z-10">

        {/* Local Recovery Offline Banner — shown when unsaved local recovery snapshot is newer */}
        {localRecoverySnapshot && isEditable && (
          <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-foreground flex items-center gap-2">
                💾 Unsaved Offline Draft Recovered
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                  Local Recovery
                </span>
              </span>
              <p className="text-xs text-muted-foreground">
                We found unsynced edits saved on your browser from {new Date(localRecoverySnapshot.savedAt).toLocaleTimeString()}.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearLocalSnapshot(journalId);
                  setLocalRecoverySnapshot(null);
                }}
                className="text-xs font-semibold rounded-xl"
              >
                Discard
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  loadLocalRecovery(localRecoverySnapshot.title, localRecoverySnapshot.blocks);
                  clearLocalSnapshot(journalId);
                  setLocalRecoverySnapshot(null);
                }}
                className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white border-0 rounded-xl"
              >
                Restore Local Draft
              </Button>
            </div>
          </div>
        )}

        {/* Locked Journal Banner — shown when journal is submitted/approved */}


        {/* Locked Journal Banner — shown when journal is submitted/approved */}
        {previewMode && (status === "submitted" || status === "approved") && (
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-foreground flex items-center gap-2">
                🔒 This journal is read-only
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                  status === "approved"
                    ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                }`}>
                  {status === "approved" ? "Approved" : "Handed In"}
                </span>
              </span>
              <p className="text-xs text-muted-foreground">
                {status === "submitted"
                  ? "You have handed in this journal. Undo the submission to make edits."
                  : "This journal has been approved by your teacher. No edits are allowed."}
              </p>
            </div>
            {status === "submitted" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => unsubmitMutation.mutate()}
                disabled={unsubmitMutation.isPending}
                className="gap-1.5 font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 hover:border-rose-300 transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                {unsubmitMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Undoing...</span>
                  </>
                ) : (
                  <>
                    <span>↩</span>
                    <span>Undo Hand In to Edit</span>
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Paper Sheet Document Canvas Container */}
        <div className="w-full bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 shadow-[0_10px_38px_-10px_rgba(22,23,24,0.06),0_10px_20px_-15px_rgba(22,23,24,0.04)] dark:shadow-[0_10px_38px_-10px_rgba(0,0,0,0.5)] rounded-2xl p-6 sm:p-10 md:p-12 transition-all duration-200 min-h-[850px] flex flex-col gap-6">

          {/* Cover Document Info (Document Header Card) */}
          {!previewMode && (
            <div className="max-w-2xl mx-auto w-full p-3.5 border border-dashed border-border/80 rounded-xl bg-muted/20 text-xs text-muted-foreground flex justify-between items-center select-none">
              <div className="flex flex-col gap-1">
                <span><strong>Subject Code:</strong> {assignment?.classroomId ? classroomId.split("-")[0] : "N/A"}</span>
                <span><strong>Practical:</strong> Experiment {assignment?.experimentNumber || 1}</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold text-primary/70">
                <Sparkles className="size-3.5" />
                <span>Block-based Structure Active</span>
              </div>
            </div>
          )}

          {/* Drag & Drop Context (Bypassed in previewMode to prevent innerRef errors) */}
          {previewMode ? (
            <div className="flex flex-col gap-4 w-full select-text">
              {blocks.map((block) => (
                <BlockRenderer
                  key={block.id}
                  id={block.id}
                  type={block.type}
                  content={block.content}
                  previewMode={true}
                />
              ))}
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="journal-editor-canvas">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="flex flex-col gap-2 w-full min-h-[300px]"
                  >
                    {blocks.map((block, idx) => (
                      <Draggable key={block.id} draggableId={block.id} index={idx}>
                        {(draggableProvided) => (
                          <BlockWrapper
                            id={block.id}
                            index={idx}
                            provided={draggableProvided}
                            previewMode={false}
                          >
                            <BlockRenderer
                              id={block.id}
                              type={block.type}
                              content={block.content}
                              previewMode={false}
                            />
                          </BlockWrapper>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}

          {/* Add New Block Button at Bottom of Document */}
          {!previewMode && isEditable && (
            <div className="pt-6 border-t border-border/40 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => addBlock(blocks.length, "paragraph")}
                className="gap-2 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground border-dashed border-border hover:border-primary/50 cursor-pointer transition-all"
              >
                <Plus className="size-3.5" />
                <span>Add Paragraph Block</span>
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Teacher Review Panel Sidebar */}
      {user?.role === "teacher" && showReviewDrawer && (
        <ReviewDrawer
          journalId={journalId}
          classroomId={classroomId}
          journalStatus={status}
          maxMarks={assignment?.maxMarks || 10}
          currentMarks={journal?.marks}
          currentRemarks={journal?.teacherRemarks}
          onClose={() => setShowReviewDrawer(false)}
        />
      )}
    </div>

  );
}
