"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Folder,
  Layers,
  Loader2,
  MessageSquare,
  Send,
  Sliders,
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
  onClose?: () => void;
}

export default function ReviewDrawer({
  journalId,
  classroomId,
  journalStatus,
  assignment,
  studentId,
  maxMarks = 10,
  currentMarks,
  currentRemarks,
  onClose,
}: ReviewDrawerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

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

  // Global Keyboard Shortcuts (Shift + [ and Shift + ])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      if (e.shiftKey && (e.key === "{" || e.key === "[")) {
        e.preventDefault();
        if (prevSub) router.push(`/editor/${prevSub.journalId || prevSub.id}`);
      } else if (e.shiftKey && (e.key === "}" || e.key === "]")) {
        e.preventDefault();
        if (nextSub) router.push(`/editor/${nextSub.journalId || nextSub.id}`);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevSub, nextSub, router]);

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
    // Default 3-criteria rubric scaled to maxMarks
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

  const handleApprove = (advanceToNext: boolean = false) => {
    const parsedMarks = parseFloat(marks);
    if (isNaN(parsedMarks) || parsedMarks < 0 || parsedMarks > maxMarks) {
      toast.warning(`Please enter valid marks between 0 and ${maxMarks}.`);
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

  const isUnsubmittedDraft = journalStatus === "draft";
  const isChangesRequested = journalStatus === "changes_requested";
  const isApproved = journalStatus === "approved";
  const isGradingLocked = isUnsubmittedDraft || isChangesRequested;

  return (
    <div className="h-full flex flex-col select-none">
      {/* 1. Fast Student Queue Ribbon at Top */}
      {assignmentQueue.length > 0 && (
        <div className="px-3 py-2 bg-muted/60 dark:bg-zinc-800/60 border-b border-border/50 flex items-center justify-between gap-2">
          <button
            onClick={() => prevSub && router.push(`/editor/${prevSub.journalId || prevSub.id}`)}
            disabled={!prevSub}
            className="flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-muted font-semibold disabled:opacity-25 transition-all cursor-pointer disabled:cursor-not-allowed text-xs"
            title="Previous Student in Queue (Shift + [)"
          >
            <ChevronLeft className="size-3.5" />
            <span className="text-[10px]">Prev</span>
          </button>

          <div className="flex flex-col items-center min-w-0 text-center">
            <span className="font-extrabold text-xs text-foreground truncate max-w-[140px]">
              {currentSub?.studentName || "Student"}
            </span>
            <span className="text-[9px] text-muted-foreground font-mono">
              {currentStudentIndex >= 0 ? `${currentStudentIndex + 1} of ${assignmentQueue.length}` : "Queue"}
              {currentSub?.enrollmentNumber ? ` • ${currentSub.enrollmentNumber}` : ""}
            </span>
          </div>

          <button
            onClick={() => nextSub && router.push(`/editor/${nextSub.journalId || nextSub.id}`)}
            disabled={!nextSub}
            className="flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-muted font-semibold disabled:opacity-25 transition-all cursor-pointer disabled:cursor-not-allowed text-xs"
            title="Next Student in Queue (Shift + ])"
          >
            <span className="text-[10px]">Next</span>
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}

      {/* Compact Inline Title Row */}
      <div className="px-4 pt-3 pb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <MessageSquare className="size-3.5 text-indigo-500" />
          </div>
          <span className="text-[13px] font-bold text-foreground tracking-tight">Review & Grade</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="size-6 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-all cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className="h-px bg-border/50" />

      {/* Main Review Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5">
        {/* Cluster Practicals Strip (when assignment belongs to a cluster) */}
        {assignment?.clusterName && studentClusterJournals.length > 0 && (
          <div className="p-2.5 rounded-2xl bg-indigo-500/[0.05] border border-indigo-500/20 flex flex-col gap-1.5">
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

        {/* Status Callout Banner */}
        {isUnsubmittedDraft ? (
          <div className="p-3 rounded-xl border border-amber-400/30 bg-amber-50/80 dark:bg-amber-950/30 text-xs flex flex-col gap-1">
            <span className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300">
              <AlertCircle className="size-3.5 text-amber-500" />
              <span>Draft State</span>
            </span>
            <p className="text-[11px] leading-relaxed text-amber-800/80 dark:text-amber-200/80 pl-[22px]">
              Student unsubmitted to draft. Grading locked until resubmitted.
            </p>
          </div>
        ) : isChangesRequested ? (
          <div className="p-3.5 rounded-xl border border-amber-400/30 bg-amber-50/80 dark:bg-amber-950/30 text-xs flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                <AlertCircle className="size-4 text-amber-500" />
                <span>Changes Requested</span>
              </span>
              <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-amber-500/20 font-black tracking-wider text-amber-700 dark:text-amber-300">
                Revision Pending
              </span>
            </div>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80 leading-relaxed font-medium">
              Student is revising this document. Evaluation and grading will unlock once resubmitted.
            </p>
          </div>
        ) : isApproved ? (
          <div className="p-3.5 rounded-xl border border-emerald-400/30 bg-emerald-50/80 dark:bg-emerald-950/30 text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span>Approved & Graded</span>
              </span>
              <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 font-black tracking-wider text-emerald-700 dark:text-emerald-300">
                Completed
              </span>
            </div>
            <p className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80 leading-relaxed font-medium">
              This document has been evaluated and approved. Editing is locked unless changes are requested.
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-xl border border-blue-400/30 bg-blue-50/80 dark:bg-blue-950/30 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-300">
              <CheckCircle2 className="size-3.5 text-blue-500" />
              <span>{journalStatus.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
            </span>
            <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-blue-500/15 font-black tracking-wider text-blue-600 dark:text-blue-400">
              Handed In
            </span>
          </div>
        )}

        {/* Evaluation & Grading Section */}
        <div className="flex flex-col gap-2.5">
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
            /* Read-Only Locked Evaluation Summary Card */
            <div className="p-4 rounded-xl border border-border/60 bg-muted/20 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Final Score:</span>
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
                <div className="flex flex-col gap-1 text-xs pt-1 border-t border-border/40">
                  <span className="text-[11px] font-semibold text-muted-foreground">Remarks:</span>
                  <p className="text-foreground/90 font-medium italic leading-relaxed">"{remarks}"</p>
                </div>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditingEvaluation(true)}
                className="mt-1 w-full h-8 text-xs font-semibold rounded-xl border-border/60 hover:bg-muted cursor-pointer"
              >
                <span>Edit Evaluation & Grade</span>
              </Button>
            </div>
          ) : (
            /* Editable Evaluation Form */
            <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 flex flex-col gap-3">
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
                <span className="text-xs font-bold text-foreground">Total Awarded Marks:</span>
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
                    className="w-20 px-2.5 py-1.5 text-sm font-bold text-center bg-background text-foreground border border-input rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none disabled:opacity-40 transition-all"
                  />
                  <span className="text-xs text-muted-foreground font-bold">/ {maxMarks}</span>
                </div>
              </div>

              {/* Remarks */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground">Teacher Feedback Remarks:</span>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add evaluation feedback..."
                  disabled={isGradingLocked}
                  className="w-full p-2.5 text-xs bg-background border border-input rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none resize-none font-medium text-foreground disabled:opacity-40 placeholder:text-muted-foreground/50 transition-all"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => {
                    handleApprove(false);
                    setIsEditingEvaluation(false);
                  }}
                  disabled={isGradingLocked || approveMutation.isPending}
                  className="w-full h-9 gap-2 text-xs font-semibold glass-btn glass-btn-emerald active:scale-[0.98] rounded-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {approveMutation.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>{isApproved ? "Updating..." : "Approving..."}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      <span>{isApproved ? "Update Evaluation" : "Approve & Grade"}</span>
                    </>
                  )}
                </Button>

                {/* Approve & Next Student Button */}
                {!isApproved && nextSub && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApprove(true)}
                    disabled={isGradingLocked || approveMutation.isPending}
                    className="w-full h-8 gap-1.5 text-xs font-semibold rounded-full border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
                    title="Approve current journal and automatically open next student in queue"
                  >
                    <span>Approve & Next (Shift+])</span>
                    <ArrowRight className="size-3" />
                  </Button>
                )}

                {isApproved && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditingEvaluation(false)}
                    className="w-full h-8 text-xs font-semibold rounded-full cursor-pointer"
                  >
                    Cancel Edit
                  </Button>
                )}

                {!isApproved && (
                  <Button
                    size="sm"
                    onClick={() => setShowRequestDialog(true)}
                    disabled={isGradingLocked || requestChangesMutation.isPending}
                    className="w-full h-8 gap-1.5 text-xs font-semibold glass-btn-amber rounded-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Send className="size-3" />
                    <span>Request Changes</span>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-border/50" />

        {/* Block Annotations List */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/70 px-0.5">
            Annotations ({comments?.length || 0})
          </span>

          {commentsLoading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground/50" />
            </div>
          ) : !comments || comments.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/60 font-medium text-center py-6 px-3">
              No annotations yet. Use the annotation toolbar on any block to add feedback.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {comments.map((c) => {
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

                return (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl border border-border/50 bg-background/60 text-xs flex flex-col gap-1.5 hover:border-border/80 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground text-[11px]">{c.authorName}</span>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md border ${badgeStyle}`}>
                        {annTypeUpper}
                      </span>
                    </div>
                    <p className="text-muted-foreground font-medium leading-relaxed text-[11px]">
                      {c.content || c.message}
                    </p>
                    {c.suggestedContent && (
                      <div className="p-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-400/20 text-[10px] font-mono text-amber-800 dark:text-amber-200">
                        Suggestion: {JSON.stringify(c.suggestedContent.text || c.suggestedContent)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Request Changes Modal Dialog */}
      {showRequestDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
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
              className="w-full p-3 text-xs bg-background border border-input rounded-xl focus:ring-1 focus:ring-amber-500 focus:outline-none resize-none"
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
        </div>
      )}
    </div>
  );
}
