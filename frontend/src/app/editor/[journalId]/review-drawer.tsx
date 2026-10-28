"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  Folder,
  Loader2,
  Lock,
  MessageSquare,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

interface ReviewDrawerProps {
  journalId: string;
  classroomId: string;
  journalStatus: string;
  assignment?: any;
  studentId?: string;
  maxMarks?: number;
  currentMarks?: number;
  currentRemarks?: string;
  blocks?: any[];
  onClose?: () => void;
}

const getBlockTypeMeta = (type?: string) => {
  switch (type) {
    case "table":
      return { label: "Table Block", icon: "📊", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25" };
    case "graph":
      return { label: "Graph Plot", icon: "📈", color: "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/25" };
    case "code":
      return { label: "Code Block", icon: "💻", color: "text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/25" };
    case "equation":
      return { label: "Math Block", icon: "🧮", color: "text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/25" };
    case "observation":
      return { label: "Observation", icon: "📋", color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25" };
    case "result":
      return { label: "Result Block", icon: "🎯", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25" };
    case "heading":
      return { label: "Heading Block", icon: "📑", color: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/25" };
    case "callout":
      return { label: "Callout Block", icon: "💡", color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25" };
    case "image":
      return { label: "Image Block", icon: "🖼️", color: "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/25" };
    default:
      return { label: "Document Block", icon: "📄", color: "text-muted-foreground bg-muted/60 border-border/60" };
  }
};

export default function ReviewDrawer({
  journalId,
  classroomId,
  journalStatus,
  assignment,
  studentId,
  maxMarks = 10,
  currentMarks,
  currentRemarks,
  blocks,
  onClose,
}: ReviewDrawerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [marks, setMarks] = useState<string>(currentMarks !== undefined && currentMarks !== null ? String(currentMarks) : "");
  const [remarks, setRemarks] = useState<string>(currentRemarks || "");
  const [requestRemarks, setRequestRemarks] = useState<string>("");
  const [showRequestDialog, setShowRequestDialog] = useState<boolean>(false);
  const [isEditingEvaluation, setIsEditingEvaluation] = useState(false);
  const [gradingMode, setGradingMode] = useState<"flat" | "rubric">(
    assignment?.rubric && assignment.rubric.length > 0 ? "rubric" : "flat"
  );
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({});

  // 1. Fetch Comments Thread
  const { data: comments, isLoading: commentsLoading } = useQuery<any[]>({
    queryKey: ["comments", journalId],
    queryFn: () => api.get(`/comments/journal/${journalId}`),
  });

  // Split comments into active block annotations vs removed block annotations and compute resolution progress
  const {
    activeComments,
    removedBlockComments,
    satisfactionRate,
    satisfiedCount,
    totalFeedback,
    actionItemsRate,
    addressedActionItems,
    totalActionItems,
  } = useMemo(() => {
    if (!comments || comments.length === 0) {
      return {
        activeComments: [],
        removedBlockComments: [],
        satisfactionRate: 100,
        satisfiedCount: 0,
        totalFeedback: 0,
        actionItemsRate: 100,
        addressedActionItems: 0,
        totalActionItems: 0,
      };
    }

    const activeBlockIds = new Set((blocks || []).map((b: any) => b.id));
    const active: any[] = [];
    const removed: any[] = [];

    // Filter root comments
    const rootComments = comments.filter((c) => !c.parentCommentId);

    for (const c of rootComments) {
      if (c.blockId && !activeBlockIds.has(c.blockId)) {
        removed.push(c);
      } else {
        active.push(c);
      }
    }

    // Overall Feedback Satisfaction
    const total = rootComments.length;
    let satisfied = 0;
    let actionItems = 0;
    let actionItemsAddressed = 0;

    for (const c of rootComments) {
      const type = (c.type || "comment").toLowerCase();
      const isResolved =
        c.status === "resolved" ||
        c.reviewStatus === "resolved" ||
        c.appliedAction === "deleted";
      const isInformational =
        type === "comment" || type === "approval" || type === "highlight";

      if (isInformational || isResolved) {
        satisfied += 1;
      }

      if (type === "suggestion" || type === "warning" || type === "question") {
        actionItems += 1;
        const hasReplies = comments.some((child) => child.parentCommentId === c.id);
        if (isResolved || (type === "question" && hasReplies)) {
          actionItemsAddressed += 1;
        }
      }
    }

    return {
      activeComments: active,
      removedBlockComments: removed,
      satisfactionRate: total > 0 ? Math.round((satisfied / total) * 100) : 100,
      satisfiedCount: satisfied,
      totalFeedback: total,
      actionItemsRate: actionItems > 0 ? Math.round((actionItemsAddressed / actionItems) * 100) : 100,
      addressedActionItems: actionItemsAddressed,
      totalActionItems: actionItems,
    };
  }, [comments, blocks]);

  // 2. Fetch Classroom Submissions Queue
  const { data: allSubmissions } = useQuery<any[]>({
    queryKey: ["submissions", classroomId],
    queryFn: () => api.get(`/journals/classroom/${classroomId}/submissions`),
    enabled: !!classroomId,
  });

  // Calculate Student Queue for current assignment
  const assignmentQueue = useMemo(() => {
    if (!allSubmissions || !assignment?.id) return [];
    return allSubmissions.filter((s) => s.assignmentId === assignment.id);
  }, [allSubmissions, assignment?.id]);

  const currentStudentIndex = useMemo(() => {
    if (!assignmentQueue.length) return -1;
    return assignmentQueue.findIndex((s) => s.journalId === journalId || s.id === journalId);
  }, [assignmentQueue, journalId]);

  const currentSub = currentStudentIndex >= 0 ? assignmentQueue[currentStudentIndex] : null;
  const prevSub = currentStudentIndex > 0 ? assignmentQueue[currentStudentIndex - 1] : null;
  const nextSub =
    currentStudentIndex >= 0 && currentStudentIndex < assignmentQueue.length - 1
      ? assignmentQueue[currentStudentIndex + 1]
      : null;

  // Jump smoothly to a block and highlight with temporary ring
  const handleJumpToBlock = (blockId: string) => {
    if (!blockId) return;
    const el = document.getElementById(`block-${blockId}`) || document.getElementById(blockId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-4", "ring-indigo-500/70", "ring-offset-4", "transition-all", "duration-300");
      setTimeout(() => {
        el.classList.remove("ring-4", "ring-indigo-500/70", "ring-offset-4");
      }, 2000);
    } else {
      toast.info("Target block not found in current document view.");
    }
  };

  // 3. Approve Journal Mutation
  const approveMutation = useMutation({
    mutationFn: (data: { marks: number; remarks?: string }) =>
      api.post(`/journals/${journalId}/approve`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal", journalId] });
      queryClient.invalidateQueries({ queryKey: ["submissions", classroomId] });
      toast.success("Journal Approved & Graded successfully!", { title: "🎉 Evaluation Complete" });
    },
    onError: (err: any) => {
      if (err.status === 400 || err.message?.includes("unsubmitted")) {
        toast.warning("The student has unsubmitted this journal back to Draft status. You cannot grade an unsubmitted draft.", {
          title: "⚠️ Concurrency Alert",
        });
      } else {
        toast.error(err.message || "Failed to approve journal.");
      }
    },
  });

  // 4. Request Changes Mutation
  const requestChangesMutation = useMutation({
    mutationFn: (data: { remarks: string }) =>
      api.post(`/journals/${journalId}/request-changes`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal", journalId] });
      queryClient.invalidateQueries({ queryKey: ["submissions", classroomId] });
      setShowRequestDialog(false);
      toast.success("Request for changes sent to student.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to request changes.");
    },
  });

  const isUnsubmittedDraft = journalStatus === "draft";
  const isChangesRequested = journalStatus === "changes_requested";
  const isApproved = journalStatus === "approved";
  const isGradingLocked = isUnsubmittedDraft || isChangesRequested;

  const handleApprove = (advanceToNext: boolean = false) => {
    if (isGradingLocked) {
      if (advanceToNext && nextSub) {
        toast.info("Advancing to next student in queue...");
        router.push(`/editor/${nextSub.journalId || nextSub.id}`);
      }
      return;
    }

    const parsedMarks = parseFloat(marks);
    if (isNaN(parsedMarks) || parsedMarks < 0 || parsedMarks > maxMarks) {
      toast.warning(`Please enter valid marks between 0 and ${maxMarks} before approving.`);
      return;
    }
    approveMutation.mutate(
      { marks: parsedMarks, remarks },
      {
        onSuccess: () => {
          if (advanceToNext && nextSub) {
            toast.info("Advancing to next student in queue...");
            router.push(`/editor/${nextSub.journalId || nextSub.id}`);
          }
        },
      }
    );
  };

  const handleRequestChanges = () => {
    if (!requestRemarks.trim()) {
      toast.warning("Please enter remarks explaining what changes are requested.");
      return;
    }
    requestChangesMutation.mutate({ remarks: requestRemarks });
  };

  // Global Keyboard Shortcuts (Shift + [ and Shift + ])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable ||
        target?.closest("[contenteditable='true']")
      ) {
        return;
      }
      if (e.shiftKey && (e.key === "{" || e.key === "[")) {
        e.preventDefault();
        if (prevSub) {
          router.push(`/editor/${prevSub.journalId || prevSub.id}`);
        } else {
          toast.info("Already at first student in queue.");
        }
      } else if (e.shiftKey && (e.key === "}" || e.key === "]")) {
        e.preventDefault();
        if (isGradingLocked) {
          if (nextSub) {
            router.push(`/editor/${nextSub.journalId || nextSub.id}`);
          } else {
            toast.info("Already at last student in queue.");
          }
        } else if (!isApproved) {
          handleApprove(true);
        } else if (nextSub) {
          router.push(`/editor/${nextSub.journalId || nextSub.id}`);
        } else {
          toast.info("Already at last student in queue.");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevSub, nextSub, router, isApproved, isGradingLocked, marks, remarks, maxMarks]);

  // Cluster Practicals for Current Student
  const currentStudentId = studentId || currentSub?.studentId;
  const studentClusterJournals = useMemo(() => {
    if (!allSubmissions || !assignment?.clusterName || !currentStudentId) return [];
    return allSubmissions
      .filter((s) => s.studentId === currentStudentId && s.clusterName === assignment.clusterName)
      .sort((a, b) => a.experimentNumber - b.experimentNumber);
  }, [allSubmissions, assignment?.clusterName, currentStudentId]);

  // Criteria Rubric Setup
  const rubricCriteria = useMemo(() => {
    if (assignment?.rubric && assignment.rubric.length > 0) {
      return assignment.rubric;
    }
    const setup = Math.max(1, Math.round(maxMarks * 0.3));
    const data = Math.max(1, Math.round(maxMarks * 0.4));
    const concl = Math.max(1, maxMarks - setup - data);
    return [
      { id: "c1", title: "Setup & Circuit", maxMarks: setup },
      { id: "c2", title: "Data & Graphs", maxMarks: data },
      { id: "c3", title: "Conclusion & Viva", maxMarks: concl },
    ];
  }, [assignment?.rubric, maxMarks]);

  const handleRubricScoreChange = (criterionId: string, score: number) => {
    const updated = { ...rubricScores, [criterionId]: score };
    setRubricScores(updated);
    const sum = Object.values(updated).reduce((a, b) => a + b, 0);
    setMarks(String(Math.min(maxMarks, sum)));
  };

  return (
    <div className="h-full flex flex-col select-none bg-background/95">
      {/* 1. Fast Student Queue & Cockpit Header */}
      <div className="px-3 py-2 bg-muted/50 dark:bg-zinc-800/60 border-b border-border/50 flex items-center justify-between gap-1.5 shrink-0">
        <button
          onClick={() => prevSub && router.push(`/editor/${prevSub.journalId || prevSub.id}`)}
          disabled={!prevSub}
          className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted font-bold disabled:opacity-25 transition-all cursor-pointer disabled:cursor-not-allowed text-xs text-foreground/80 hover:text-foreground shrink-0"
          title="Previous Student in Queue (Shift + [)"
        >
          <ChevronLeft className="size-3.5" />
          <span className="text-[11px]">Prev</span>
        </button>

        <div className="flex flex-col items-center min-w-0 text-center px-1">
          <span className="font-extrabold text-xs text-foreground truncate max-w-[145px]">
            {currentSub?.studentName || "Student Review"}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {currentStudentIndex >= 0 ? `${currentStudentIndex + 1} of ${assignmentQueue.length}` : "Queue"}
            {currentSub?.enrollmentNumber ? ` • ${currentSub.enrollmentNumber}` : ""}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => nextSub && router.push(`/editor/${nextSub.journalId || nextSub.id}`)}
            disabled={!nextSub}
            className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted font-bold disabled:opacity-25 transition-all cursor-pointer disabled:cursor-not-allowed text-xs text-foreground/80 hover:text-foreground shrink-0"
            title="Next Student in Queue (Shift + ])"
          >
            <span className="text-[11px]">Next</span>
            <ChevronRight className="size-3.5" />
          </button>

          {onClose && (
            <>
              <div className="h-4 w-px bg-border/60 mx-0.5" />
              <button
                onClick={onClose}
                className="size-6 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/80 transition-all cursor-pointer"
                title="Close Review Cockpit (Shift + E)"
              >
                <X className="size-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Scrollable Body: Progressive Review Flow */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 flex flex-col gap-3.5 no-scrollbar">
        {/* Cluster Practicals Strip */}
        {assignment?.clusterName && studentClusterJournals.length > 0 && (
          <div className="p-2.5 rounded-2xl bg-indigo-500/[0.05] border border-indigo-500/20 flex flex-col gap-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1 truncate max-w-[170px]">
                <Folder className="size-3 shrink-0" />
                <span className="truncate">{assignment.clusterName}</span>
              </span>
              <span className="text-[9px] font-bold text-muted-foreground shrink-0">
                {studentClusterJournals.filter((j) => j.status === "approved").length}/{studentClusterJournals.length} approved
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {studentClusterJournals.map((j) => {
                const isCurrent = (j.journalId || j.id) === journalId;
                const isSubApproved = j.status === "approved";
                const isSubSubmitted = j.status === "submitted" || j.status === "late_submitted";
                const isSubRevoked = j.isRevoked || j.status === "draft";

                return (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => router.push(`/editor/${j.journalId || j.id}`)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                      isCurrent
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-background/80 hover:bg-muted text-foreground border border-border/60"
                    }`}
                    title={`Experiment ${j.experimentNumber}: ${j.title || ""}`}
                  >
                    <span>Exp #{j.experimentNumber}</span>
                    {isSubApproved ? (
                      <span title="Approved">✅</span>
                    ) : isSubSubmitted ? (
                      <span title="Submitted">⚡</span>
                    ) : isSubRevoked ? (
                      <span title="Draft / Revoked">⏳</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* State Banner (Only when editing/grading is locked) */}
        {isUnsubmittedDraft ? (
          <div className="p-3 rounded-xl border border-amber-400/40 bg-amber-500/10 text-xs flex flex-col gap-1">
            <span className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300">
              <AlertCircle className="size-3.5 text-amber-500 shrink-0" />
              <span>Draft State</span>
            </span>
            <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-200/90 pl-[22px]">
              Student unsubmitted to draft. Grading locked until resubmitted.
            </p>
          </div>
        ) : isChangesRequested ? (
          <div className="p-3 rounded-xl border border-amber-400/40 bg-amber-500/10 text-xs flex flex-col gap-1">
            <span className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300">
              <AlertCircle className="size-3.5 text-amber-500 shrink-0" />
              <span>Changes Requested</span>
            </span>
            <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-200/90 pl-[22px]">
              Student is revising this document. Grading will unlock once resubmitted.
            </p>
          </div>
        ) : null}

        {/* Resolution Progress Box */}
        {totalFeedback > 0 && (
          <div className="p-3 rounded-2xl bg-muted/40 dark:bg-zinc-800/40 border border-border/70 flex flex-col gap-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                Resolution Progress
              </span>
              <span className="text-xs font-extrabold text-primary font-mono">
                {satisfactionRate}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  satisfactionRate >= 100
                    ? "bg-emerald-500"
                    : satisfactionRate >= 50
                    ? "bg-primary"
                    : "bg-amber-500"
                }`}
                style={{ width: `${satisfactionRate}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium pt-0.5">
              <span>{satisfiedCount} of {totalFeedback} feedback satisfied</span>
              {totalActionItems > 0 && (
                <span className="font-semibold text-foreground/90">
                  {addressedActionItems}/{totalActionItems} action items
                </span>
              )}
            </div>
          </div>
        )}

        {/* Active Block Annotations & Feedback Inspector */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/70 flex items-center gap-1.5">
              <MessageSquare className="size-3 text-indigo-500" />
              Block Feedback ({activeComments.length})
            </span>
            <span className="text-[10px] text-muted-foreground/70 font-medium">
              Click card to jump
            </span>
          </div>

          {commentsLoading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground/50" />
            </div>
          ) : activeComments.length === 0 ? (
            <div className="p-3.5 rounded-xl border border-dashed border-border/60 text-center bg-muted/10">
              <p className="text-[11px] text-muted-foreground/70 font-medium">
                No active block annotations in this submission.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {activeComments.map((c) => {
                const targetBlock = blocks?.find((b) => b.id === c.blockId);
                const blockMeta = getBlockTypeMeta(targetBlock?.type);
                const annTypeUpper = (c.type || "COMMENT").toUpperCase();
                const badgeColors: Record<string, string> = {
                  HIGHLIGHT: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-400/30",
                  WARNING: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-400/30",
                  SUGGESTION: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-400/30",
                  APPROVAL: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-400/30",
                  QUESTION: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-400/30",
                };
                const badgeStyle =
                  badgeColors[annTypeUpper] ||
                  "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-400/30";

                const isResolved =
                  c.status === "resolved" ||
                  c.reviewStatus === "resolved" ||
                  c.appliedAction === "deleted";

                return (
                  <div
                    key={c.id}
                    onClick={() => handleJumpToBlock(c.blockId)}
                    role="button"
                    tabIndex={0}
                    className={`p-3 rounded-xl border text-xs flex flex-col gap-2 transition-all cursor-pointer group hover:shadow-xs ${
                      isResolved
                        ? "bg-emerald-500/[0.03] border-emerald-500/30 opacity-85 hover:border-emerald-500/60"
                        : "border-border/60 bg-background/80 hover:border-indigo-500/50 hover:bg-background"
                    }`}
                    title="Click to jump to this block in the document"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      {/* Block Type Tag with Icon */}
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${blockMeta.color}`}>
                        <span>{blockMeta.icon}</span>
                        <span>{blockMeta.label}</span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        {isResolved ? (
                          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Resolved
                          </span>
                        ) : null}
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md border ${badgeStyle}`}>
                          {annTypeUpper}
                        </span>
                      </div>
                    </div>

                    <p className="text-muted-foreground font-medium leading-relaxed text-[11px] group-hover:text-foreground transition-colors">
                      {c.content || c.message}
                    </p>

                    {c.suggestedContent && (
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-800 dark:text-amber-200">
                        Suggestion: {JSON.stringify(c.suggestedContent.text || c.suggestedContent)}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-border/30 text-[10px] text-muted-foreground/70">
                      <span className="font-semibold text-foreground/80">{c.authorName}</span>
                      <span className="flex items-center gap-1 text-primary/70 font-semibold group-hover:text-primary transition-colors">
                        <span>Jump to block</span>
                        <CornerDownRight className="size-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Feedback on Removed Blocks Section */}
        {removedBlockComments.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="size-3" />
                Removed Blocks ({removedBlockComments.length})
              </span>
              <span className="text-[9px] font-mono text-muted-foreground">Preserved Audit</span>
            </div>
            <div className="flex flex-col gap-2">
              {removedBlockComments.map((c) => (
                <div
                  key={c.id}
                  className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-[11px]">{c.authorName}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      {c.appliedAction === "deleted" ? "Block Deleted (Resolved)" : "Block Removed"}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    {c.content || c.message}
                  </p>
                  {c.suggestedContent && (
                    <div className="p-1.5 rounded bg-background/80 text-[10px] font-mono text-muted-foreground">
                      Instruction: {JSON.stringify(c.suggestedContent.text || c.suggestedContent)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evaluation & Scoring Form */}
        <div className="flex flex-col gap-2.5 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/70 flex items-center gap-1.5">
              <Sparkles className="size-3 text-primary/60" />
              Evaluation & Marks
            </span>

            {/* Grading Mode Toggle (Flat vs Rubric) */}
            {!isApproved || isEditingEvaluation ? (
              <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-0.5 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setGradingMode("flat")}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    gradingMode === "flat"
                      ? "bg-background text-foreground shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Flat
                </button>
                <button
                  type="button"
                  onClick={() => setGradingMode("rubric")}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    gradingMode === "rubric"
                      ? "bg-background text-foreground shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Rubric
                </button>
              </div>
            ) : null}
          </div>

          {isApproved && !isEditingEvaluation ? (
            /* Read-Only Approved Evaluation Summary Card */
            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Evaluation Score:</span>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black text-foreground">
                    {marks || 0} / {maxMarks}
                  </span>
                  <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    {Math.round(((Number(marks) || 0) / maxMarks) * 100)}%
                  </span>
                </div>
              </div>

              {remarks && (
                <div className="flex flex-col gap-1 text-xs pt-1.5 border-t border-border/40">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Remarks:</span>
                  <p className="text-foreground/90 font-medium italic leading-relaxed text-[11px]">"{remarks}"</p>
                </div>
              )}
            </div>
          ) : (
            /* Editable Evaluation Form */
            <div className="p-3 rounded-xl border border-border/60 bg-muted/20 flex flex-col gap-2.5">
              {/* Criterion Rubric Mode */}
              {gradingMode === "rubric" ? (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Scoring Criteria
                  </span>
                  {rubricCriteria.map((crit: any) => {
                    const currentVal = rubricScores[crit.id] !== undefined ? rubricScores[crit.id] : "";
                    return (
                      <div
                        key={crit.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-background/80 border border-border/60 text-xs"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-foreground truncate">{crit.title}</span>
                          <span className="text-[9px] text-muted-foreground">Max {crit.maxMarks} marks</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={crit.maxMarks}
                          step="0.5"
                          value={currentVal}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            handleRubricScoreChange(crit.id, isNaN(val) ? 0 : Math.min(crit.maxMarks, Math.max(0, val)));
                          }}
                          placeholder={`0–${crit.maxMarks}`}
                          disabled={isGradingLocked}
                          className="w-16 px-2 py-1 text-xs font-bold text-center bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {/* Final Marks Display/Input */}
              <div className="flex items-center justify-between pt-1 border-t border-border/40">
                <span className="text-xs font-bold text-foreground">Awarded Marks:</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    max={maxMarks}
                    step="0.5"
                    value={marks}
                    onChange={(e) => setMarks(e.target.value)}
                    placeholder={`0–${maxMarks}`}
                    disabled={isGradingLocked}
                    className="w-20 px-2 py-1 text-sm font-black text-center bg-background text-foreground border border-input rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none disabled:opacity-40 transition-all"
                  />
                  <span className="text-xs text-muted-foreground font-bold">/ {maxMarks}</span>
                </div>
              </div>

              {/* Remarks */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-muted-foreground">Teacher Remarks:</span>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add evaluation feedback..."
                  disabled={isGradingLocked}
                  className="w-full p-2 text-xs bg-background border border-input rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none resize-none font-medium text-foreground disabled:opacity-40 placeholder:text-muted-foreground/50 transition-all"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Pinned Liquid-Glass Bottom Cockpit */}
      <div className="shrink-0 p-3 pb-4 border-t border-border/60 bg-background/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-lg flex flex-col gap-2 z-10">
        {!isApproved || isEditingEvaluation ? (
          <>
            {/* If grading is locked (e.g. Student Draft), don't show disabled Approve button — provide active navigation! */}
            {isGradingLocked ? (
              <div className="flex flex-col gap-1.5">
                {nextSub ? (
                  <button
                    type="button"
                    onClick={() => {
                      toast.info("Navigating to next student in queue...");
                      router.push(`/editor/${nextSub.journalId || nextSub.id}`);
                    }}
                    className="w-full h-9 px-4 rounded-full flex items-center justify-center gap-2 text-xs font-bold glass-btn glass-btn-blue active:scale-95 cursor-pointer transition-all select-none"
                  >
                    <ArrowRight className="size-3.5" />
                    <span>Next Student in Queue</span>
                    <span className="text-[10px] font-mono font-bold opacity-75">(Shift + ])</span>
                  </button>
                ) : (
                  <div className="w-full py-2 px-3 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-center gap-2">
                    <Lock className="size-3.5" />
                    <span>Grading Locked — Student Drafting</span>
                  </div>
                )}

                <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  <Lock className="size-3 shrink-0" />
                  <span>Grading locked ({isUnsubmittedDraft ? "Draft State" : "Revision Pending"})</span>
                </div>
              </div>
            ) : (
              /* Evaluatable State: Apple-grade Liquid Glass Approve Button */
              <>
                <button
                  type="button"
                  onClick={() => {
                    handleApprove(Boolean(nextSub));
                    setIsEditingEvaluation(false);
                  }}
                  disabled={approveMutation.isPending}
                  className="w-full h-9 px-4 rounded-full flex items-center justify-center gap-2 text-xs font-bold glass-btn glass-btn-emerald active:scale-95 cursor-pointer disabled:opacity-50 transition-all select-none"
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-3.5" />
                  )}
                  <span>
                    {isApproved
                      ? "Update Evaluation"
                      : nextSub
                      ? "Approve & Next"
                      : "Approve & Complete"}
                  </span>
                  {!isApproved && (
                    <span className="text-[10px] font-mono font-bold opacity-75 ml-1">
                      (Shift + ])
                    </span>
                  )}
                </button>

                {/* Secondary Action Row */}
                <div className="flex items-center gap-2">
                  {!isApproved && nextSub && (
                    <button
                      type="button"
                      onClick={() => {
                        handleApprove(false);
                        setIsEditingEvaluation(false);
                      }}
                      disabled={approveMutation.isPending}
                      className="flex-1 h-8 px-3 rounded-full text-[11px] font-semibold text-foreground/80 hover:text-foreground bg-muted/40 hover:bg-muted/70 border border-border/70 active:scale-95 transition-all cursor-pointer select-none"
                      title="Approve current journal and stay on this student"
                    >
                      Approve Only
                    </button>
                  )}

                  {!isApproved && (
                    <button
                      type="button"
                      onClick={() => setShowRequestDialog(true)}
                      disabled={requestChangesMutation.isPending}
                      className="flex-1 h-8 px-3 rounded-full text-[11px] font-bold glass-btn glass-btn-amber flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer transition-all select-none"
                    >
                      <Send className="size-3" />
                      <span>Request Changes</span>
                    </button>
                  )}

                  {isEditingEvaluation && (
                    <button
                      type="button"
                      onClick={() => setIsEditingEvaluation(false)}
                      className="flex-1 h-8 px-3 rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/70 border border-border/70 active:scale-95 transition-all cursor-pointer select-none"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          /* Approved State Cockpit */
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-foreground">
                Approved ({marks || 0}/{maxMarks})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingEvaluation(true)}
              className="h-8 px-3 text-xs font-bold rounded-xl border border-border/80 bg-background hover:bg-muted text-foreground transition-all cursor-pointer shadow-2xs active:scale-95 select-none"
            >
              Edit Grade
            </button>
          </div>
        )}
      </div>

      {/* Request Changes Modal Dialog — Teleported via Portal directly to body */}
      {mounted && showRequestDialog && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-amber-500/30 p-6 shadow-2xl flex flex-col gap-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <AlertCircle className="size-5 text-amber-500" />
              Request Corrections from Student
            </h3>
            <p className="text-xs text-muted-foreground">
              Describe what changes or corrections the student must make before resubmitting. This will reopen their journal for editing.
            </p>
            <textarea
              rows={4}
              value={requestRemarks}
              onChange={(e) => setRequestRemarks(e.target.value)}
              placeholder="e.g. Please recalculate observation table column 3 and update your conclusion..."
              className="w-full p-3 text-xs bg-background border border-input rounded-xl focus:ring-1 focus:ring-amber-500 focus:outline-none resize-none font-medium"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowRequestDialog(false)} className="rounded-xl cursor-pointer">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRequestChanges}
                disabled={requestChangesMutation.isPending}
                className="gap-1.5 font-semibold glass-btn-amber h-9 px-4 rounded-xl cursor-pointer active:scale-95 transition-all duration-150"
              >
                {requestChangesMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                <span>Send Request</span>
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
