/**
 * Teacher Classroom Submissions & Grading Matrix Page.
 *
 * Provides assignment-specific and batch-filtered view of all student journal submissions.
 */

"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, GraduationCap, Sparkles, Filter, CheckCircle2, AlertTriangle, FileEdit } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClassroomGradesPage({ params }: PageProps) {
  const { id: classroomId } = use(params);
  const [selectedBatch, setSelectedBatch] = useState<string>("ALL");

  // Fetch classroom details
  const { data: classroom } = useQuery<any>({
    queryKey: ["classroom", classroomId],
    queryFn: () => api.get(`/classrooms/${classroomId}`),
  });

  // Fetch classroom assignments
  const { data: assignments } = useQuery<any[]>({
    queryKey: ["assignments", classroomId],
    queryFn: () => api.get(`/classrooms/${classroomId}/assignments`),
  });

  // Fetch classroom submissions for teacher
  const { data: submissions, isLoading: submissionsLoading } = useQuery<any[]>({
    queryKey: ["submissions", classroomId],
    queryFn: () => api.get(`/journals/classroom/${classroomId}/submissions`),
  });

  return (
    <div className="flex min-h-screen flex-col bg-background relative overflow-x-hidden">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="rounded-xl gap-1">
              <Link href={`/classrooms/${classroomId}`}>
                <ArrowLeft className="size-4" />
                <span>Back to Classroom</span>
              </Link>
            </Button>
            <div className="h-4 w-px bg-border" />
            <h1 className="text-base font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="size-5 text-indigo-500" />
              <span>Submissions & Grading Matrix</span>
            </h1>
          </div>
          {classroom && (
            <span className="text-xs font-semibold text-muted-foreground">
              {classroom.subject} • {classroom.name}
            </span>
          )}
        </div>
      </header>

      {/* Main Workspace Content */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-6">
        {/* Header summary */}
        <div className="p-6 rounded-3xl glass-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">Student Hand-ins & Reviews</h2>
            <p className="text-xs text-muted-foreground">
              Review student practical journals, apply block annotations, evaluate marks, and handle revocations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-2xl font-extrabold text-indigo-500">{submissions?.length || 0}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Hand-ins</span>
            </div>
          </div>
        </div>

        {/* Batch Filter Bar */}
        {classroom?.batches && classroom.batches.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 glass-pill p-2 rounded-2xl">
            <span className="text-xs font-bold text-muted-foreground px-2 flex items-center gap-1">
              <Filter className="size-3.5" /> Filter by Batch:
            </span>
            <button
              onClick={() => setSelectedBatch("ALL")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedBatch === "ALL"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "glass-pill text-muted-foreground hover:text-foreground"
              }`}
            >
              All Batches
            </button>
            {classroom.batches.map((b: string) => (
              <button
                key={b}
                onClick={() => setSelectedBatch(b)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedBatch === b
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "glass-pill text-muted-foreground hover:text-foreground"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        )}

        {/* Submissions List */}
        {submissionsLoading ? (
          <div className="flex items-center justify-center p-12 glass-card rounded-3xl">
            <p className="text-sm text-muted-foreground animate-pulse">Loading student submissions...</p>
          </div>
        ) : !submissions || submissions.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-3xl glass-card text-center p-6">
            <GraduationCap className="size-10 text-muted-foreground/50 mb-3" />
            <h4 className="font-bold text-lg tracking-tight">No Submissions Found</h4>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              When students hand in their practical lab journals for this classroom, they will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {submissions
              .filter((sub) => selectedBatch === "ALL" || sub.studentBatch === selectedBatch || !sub.studentBatch)
              .map((sub) => (
                <div
                  key={sub.id}
                  className="p-5 rounded-3xl glass-card flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-indigo-500/30 transition-all duration-200"
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-primary/10 text-primary border border-primary/20">
                        Exp #{sub.experimentNumber}
                      </span>
                      <h4 className="font-bold text-sm text-foreground">
                        {sub.studentName} ({sub.enrollmentNumber || "No Enr."})
                      </h4>
                      {sub.studentBatch && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                          {sub.studentBatch}
                        </span>
                      )}
                      {sub.isRevoked && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/30 flex items-center gap-1">
                          ⚠️ Revoked Submission
                        </span>
                      )}
                      {(sub.isLate || sub.status === "late_submitted") && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-600 border border-rose-500/30">
                          Late Submission
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">
                      {sub.assignmentTitle} • {sub.submittedAt ? `Handed in ${new Date(sub.submittedAt).toLocaleDateString()}` : "In Progress"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${
                        sub.status === "approved"
                          ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                          : sub.status === "submitted" || sub.status === "late_submitted"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : sub.status === "changes_requested"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {sub.status === "approved"
                        ? `Approved (${sub.marks}/${sub.maxMarks})`
                        : sub.status === "submitted" || sub.status === "late_submitted"
                        ? "Submitted"
                        : sub.status === "changes_requested"
                        ? "Changes Requested"
                        : "Draft"}
                    </span>

                    {sub.isRevoked ? (
                      <Button
                        disabled
                        size="sm"
                        variant="outline"
                        className="font-semibold rounded-xl h-9 px-4 text-xs opacity-60 cursor-not-allowed"
                      >
                        Revoked (Cannot Evaluate)
                      </Button>
                    ) : (
                      <Button
                        asChild
                        size="sm"
                        className="font-semibold rounded-xl h-9 px-4 text-xs active:scale-95 transition-all duration-150 cursor-pointer glass-btn-blue"
                      >
                        <Link href={`/editor/${sub.id}`}>
                          <span>{sub.status === "approved" ? "View Evaluation" : "Review Journal"}</span>
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
