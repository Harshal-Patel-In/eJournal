"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MessageSquare, AlertCircle, Send, X, Loader2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface ReviewDrawerProps {
  journalId: string;
  classroomId: string;
  journalStatus: string;
  maxMarks?: number;
  currentMarks?: number;
  currentRemarks?: string;
  onClose?: () => void;
}

export default function ReviewDrawer({
  journalId,
  classroomId,
  journalStatus,
  maxMarks = 10,
  currentMarks,
  currentRemarks,
  onClose,
}: ReviewDrawerProps) {
  const queryClient = useQueryClient();
  const [marks, setMarks] = useState<string>(currentMarks !== undefined ? String(currentMarks) : "");
  const [remarks, setRemarks] = useState<string>(currentRemarks || "");
  const [requestRemarks, setRequestRemarks] = useState<string>("");
  const [showRequestDialog, setShowRequestDialog] = useState<boolean>(false);

  // 1. Fetch Comments Thread
  const { data: comments, isLoading: commentsLoading } = useQuery<any[]>({
    queryKey: ["comments", journalId],
    queryFn: () => api.get(`/comments/journal/${journalId}`),
  });

  // 2. Approve Journal Mutation (HTTP POST /journals/{id}/approve)
  const approveMutation = useMutation({
    mutationFn: (data: { marks: number; remarks?: string }) =>
      api.post(`/journals/${journalId}/approve`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal", journalId] });
      queryClient.invalidateQueries({ queryKey: ["submissions", classroomId] });
      alert("🎉 Journal Approved & Graded successfully!");
    },
    onError: (err: any) => {
      if (err.status === 400 || err.message?.includes("unsubmitted")) {
        alert("⚠️ Concurrency Alert: The student has unsubmitted this journal back to Draft status. You cannot grade an unsubmitted draft.");
      } else {
        alert(err.message || "Failed to approve journal.");
      }
    },
  });

  // 3. Request Changes Mutation (HTTP POST /journals/{id}/request-changes)
  const requestChangesMutation = useMutation({
    mutationFn: (data: { remarks: string }) =>
      api.post(`/journals/${journalId}/request-changes`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal", journalId] });
      queryClient.invalidateQueries({ queryKey: ["submissions", classroomId] });
      setShowRequestDialog(false);
      alert("Request for changes sent to student.");
    },
    onError: (err: any) => {
      alert(err.message || "Failed to request changes.");
    },
  });

  const handleApprove = () => {
    const parsedMarks = parseFloat(marks);
    if (isNaN(parsedMarks) || parsedMarks < 0 || parsedMarks > maxMarks) {
      alert(`Please enter valid marks between 0 and ${maxMarks}.`);
      return;
    }
    approveMutation.mutate({ marks: parsedMarks, remarks });
  };

  const handleRequestChanges = () => {
    if (!requestRemarks.trim()) {
      alert("Please enter remarks explaining what changes are requested.");
      return;
    }
    requestChangesMutation.mutate({ remarks: requestRemarks });
  };

  const isUnsubmittedDraft = journalStatus === "draft";

  return (
    <div className="w-80 border-l border-border bg-white dark:bg-zinc-900 h-full flex flex-col shadow-2xl z-30 select-none">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Teacher Review Panel</h3>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="size-7 rounded-full">
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        {/* Status Concurrency Warning Banner */}
        {isUnsubmittedDraft ? (
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-semibold flex flex-col gap-1.5 animate-in fade-in duration-200">
            <span className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
              <AlertCircle className="size-4 shrink-0 text-amber-600" />
              Student Recalled Submission
            </span>
            <p className="text-[11px] leading-relaxed opacity-90">
              The student has unsubmitted this journal back to Draft status to make corrections. Grading is locked until they resubmit.
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <span>Status: {journalStatus.toUpperCase()}</span>
            </span>
            <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-emerald-500/20 font-bold">
              Submitted Snapshot
            </span>
          </div>
        )}

        {/* Grading Section */}
        <div className="p-4 rounded-xl border border-border/80 bg-muted/10 flex flex-col gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            Evaluation & Marks
          </span>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Marks Awarded:</span>
            <input
              type="number"
              min="0"
              max={maxMarks}
              step="0.5"
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
              placeholder={`0 - ${maxMarks}`}
              disabled={isUnsubmittedDraft}
              className="w-20 px-2.5 py-1 text-sm font-bold bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary focus:outline-none"
            />
            <span className="text-xs text-muted-foreground font-semibold">/ {maxMarks}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-foreground">Teacher Feedback Remarks:</span>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add optional evaluation feedback..."
              disabled={isUnsubmittedDraft}
              className="w-full p-2 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary focus:outline-none resize-none"
            />
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Button
              variant="default"
              size="sm"
              onClick={handleApprove}
              disabled={isUnsubmittedDraft || approveMutation.isPending}
              className="w-full gap-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-0 rounded-xl"
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Approving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  <span>Approve & Grant Grade</span>
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRequestDialog(true)}
              disabled={isUnsubmittedDraft || requestChangesMutation.isPending}
              className="w-full gap-2 text-xs font-semibold text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 border-amber-300 rounded-xl"
            >
              <span>Request Changes / Re-edit</span>
            </Button>
          </div>
        </div>

        {/* Comment Annotations List */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Block Annotations ({comments?.length || 0})
          </span>

          {commentsLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : !comments || comments.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center p-4 bg-muted/20 rounded-xl border border-dashed border-border/60">
              No block comments added yet. Select any block to add teacher feedback annotations.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl border border-border bg-card text-xs flex flex-col gap-1.5 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{c.authorName}</span>
                    <span className="text-[10px] text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-muted">
                      {c.type}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{c.message}</p>
                  {c.suggestedContent && (
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono text-amber-800 dark:text-amber-300">
                      Suggestion: {JSON.stringify(c.suggestedContent.text || c.suggestedContent)}
                    </div>
                  )}
                </div>
              ))}
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
              <Button variant="outline" size="sm" onClick={() => setShowRequestDialog(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleRequestChanges}
                disabled={requestChangesMutation.isPending}
                className="gap-1.5 font-semibold bg-amber-600 hover:bg-amber-700 text-white border-0 rounded-xl"
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
