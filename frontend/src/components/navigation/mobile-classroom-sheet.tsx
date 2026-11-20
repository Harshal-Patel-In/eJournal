"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GraduationCap,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  ChevronRight,
  Loader2,
  Calendar,
  ExternalLink,
  Plus,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { formatDateIST } from "@/lib/date";
import { MobileAdaptiveSheet } from "@/components/ui/mobile-adaptive-sheet";
import { getClassroomTheme } from "@/lib/classroom-theme";
import { cn } from "@/lib/utils";

interface MobileClassroomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  isTeacher?: boolean;
}

export function MobileClassroomSheet({
  isOpen,
  onClose,
  isTeacher = false,
}: MobileClassroomSheetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  // If user is currently on /classrooms/[id], extract that ID
  const currentClassroomId = pathname.startsWith("/classrooms/")
    ? pathname.split("/")[2]?.split("?")[0]
    : null;

  // Selected classroom drilldown state
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
  const [loadingAssignmentId, setLoadingAssignmentId] = useState<string | null>(null);

  // 1. Fetch user's classrooms
  const { data: classrooms, isLoading: classroomsLoading } = useQuery<any[]>({
    queryKey: ["classrooms"],
    queryFn: () => api.get("/classrooms"),
    staleTime: 60000,
    enabled: isOpen,
  });

  // Sync selected classroom with active page route or single classroom when sheet opens
  useEffect(() => {
    if (isOpen) {
      if (currentClassroomId) {
        setSelectedClassroomId(currentClassroomId);
      } else if (classrooms && classrooms.length === 1) {
        setSelectedClassroomId(classrooms[0].id);
      } else {
        setSelectedClassroomId(null);
      }
    }
  }, [isOpen, currentClassroomId, classrooms]);

  // 2. Fetch assignments for the selected classroom
  const { data: assignments, isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: ["assignments", selectedClassroomId],
    queryFn: () => api.get(`/classrooms/${selectedClassroomId}/assignments`),
    enabled: isOpen && !!selectedClassroomId,
  });

  // 3. Fetch student's journals (for status pills & direct links)
  const { data: journals } = useQuery<any[]>({
    queryKey: ["student-journals"],
    queryFn: () => api.get("/journals"),
    enabled: isOpen && !isTeacher,
  });

  // 4. Fetch teacher's submissions for the selected classroom
  const { data: submissions } = useQuery<any[]>({
    queryKey: ["submissions", selectedClassroomId],
    queryFn: () => api.get(`/journals/classroom/${selectedClassroomId}/submissions`),
    enabled: isOpen && isTeacher && !!selectedClassroomId,
  });

  // Active classroom record
  const activeClassroom = classrooms?.find((c) => c.id === selectedClassroomId);

  // Handler for student starting or resuming a journal, or teacher evaluating practical
  const handleOpenPractical = async (assignment: any) => {
    if (isTeacher) {
      // For teacher: navigate directly to that assignment's submissions queue in the gradebook
      onClose();
      router.push(`/classrooms/${selectedClassroomId}/grades?assignment=${assignment.id}`);
      return;
    }

    // Check if student already has a journal for this assignment
    const existingJournal = journals?.find((j: any) => j.assignmentId === assignment.id);
    if (existingJournal?.id) {
      onClose();
      router.push(`/editor/${existingJournal.id}`);
      return;
    }

    // If not started yet, initialize journal and navigate to editor
    try {
      setLoadingAssignmentId(assignment.id);
      const res: any = await api.post("/journals", { assignmentId: assignment.id });
      queryClient.invalidateQueries({ queryKey: ["student-journals"] });
      onClose();
      if (res?.id) {
        router.push(`/editor/${res.id}`);
      } else {
        router.push(`/classrooms/${selectedClassroomId}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initialize journal editor");
    } finally {
      setLoadingAssignmentId(null);
    }
  };

  // Render Status Badge for a student practical
  const renderStudentStatusBadge = (assignmentId: string) => {
    const journal = journals?.find((j: any) => j.assignmentId === assignmentId);
    if (!journal) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border/60">
          Not Started
        </span>
      );
    }

    switch (journal.status) {
      case "approved":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="size-3" />
            Approved
          </span>
        );
      case "changes_requested":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <AlertCircle className="size-3" />
            Changes Requested
          </span>
        );
      case "late_submitted":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
            <Clock className="size-3" />
            Late Submission
          </span>
        );
      case "submitted":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1">
            <Clock className="size-3" />
            Under Review
          </span>
        );
      case "draft":
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30">
            In Progress
          </span>
        );
    }
  };

  // Render Teacher submission count badge
  const renderTeacherBadge = (assignmentId: string) => {
    const pendingCount =
      submissions?.filter(
        (s: any) =>
          s.assignmentId === assignmentId &&
          (s.status === "submitted" || s.status === "late_submitted")
      ).length || 0;

    const totalCount =
      submissions?.filter((s: any) => s.assignmentId === assignmentId).length || 0;

    if (pendingCount > 0) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
          <Clock className="size-3" />
          {pendingCount} awaiting review
        </span>
      );
    }

    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border/60">
        {totalCount} submitted
      </span>
    );
  };

  // Header Title & Subtitle based on drilldown state
  const sheetTitle = selectedClassroomId && activeClassroom
    ? activeClassroom.name
    : isTeacher
    ? "Classroom Workspaces"
    : "Enrolled Subjects & Practicals";

  const sheetSubtitle = selectedClassroomId && activeClassroom
    ? `${activeClassroom.subjectCode || "LAB"} • Semester ${activeClassroom.semester} • Div ${activeClassroom.division || "1"}`
    : classrooms
    ? `${classrooms.length} active ${classrooms.length === 1 ? "classroom" : "classrooms"} • Tap to view practicals`
    : "Loading...";

  return (
    <MobileAdaptiveSheet
      isOpen={isOpen}
      onClose={onClose}
      title={sheetTitle}
      subtitle={sheetSubtitle}
    >
      <div className="flex flex-col gap-3 select-none pb-4">
        {/* =========================================================================
            STAGE 2: CLASSROOM PRACTICALS LIST (DRILLDOWN)
           ========================================================================= */}
        {selectedClassroomId && activeClassroom ? (
          <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-right-3 duration-200">
            {/* Top Navigation Bar: Back to Subjects & Open Full Classroom */}
            <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/60">
              <button
                type="button"
                onClick={() => setSelectedClassroomId(null)}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer py-1 tap-feedback"
              >
                <ArrowLeft className="size-3.5" />
                <span>All Subjects</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/classrooms/${activeClassroom.id}`);
                }}
                className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1"
                title="View full syllabus, announcements, and classroom members"
              >
                <span>Full Classroom</span>
                <ExternalLink className="size-3" />
              </button>
            </div>

            {/* Assignments Loading State */}
            {assignmentsLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                <Loader2 className="size-5 animate-spin text-primary" />
                <span>Loading practical experiments...</span>
              </div>
            ) : !assignments || assignments.length === 0 ? (
              /* No Assignments Empty State */
              <div className="p-6 rounded-2xl border border-dashed border-border/80 bg-muted/20 text-center flex flex-col items-center gap-2">
                <FileText className="size-8 text-muted-foreground/60" />
                <h4 className="text-xs font-bold text-foreground">No practicals published yet</h4>
                <p className="text-[11px] text-muted-foreground">
                  Your instructor has not published any laboratory assignments for this classroom yet.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/classrooms/${activeClassroom.id}`);
                  }}
                  className="mt-2 text-xs font-semibold text-primary hover:underline"
                >
                  Go to classroom overview →
                </button>
              </div>
            ) : (
              /* Practical Experiments List */
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-muted-foreground">
                  <span>PRACTICAL EXPERIMENTS ({assignments.length})</span>
                  <span>{isTeacher ? "SUBMISSIONS" : "STATUS"}</span>
                </div>

                {assignments.map((assignment: any, idx: number) => {
                  const isInitializing = loadingAssignmentId === assignment.id;
                  const expNum = assignment.experimentNumber || idx + 1;

                  return (
                    <div
                      key={assignment.id}
                      onClick={() => !isInitializing && handleOpenPractical(assignment)}
                      className="p-3.5 rounded-2xl border border-border/80 bg-card hover:border-primary/50 hover:shadow-md transition-all tap-feedback cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99]"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="size-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                          {isInitializing ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <span>#{expNum}</span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <h4 className="font-bold text-sm tracking-tight text-foreground truncate">
                            {assignment.title}
                          </h4>

                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                            {assignment.dueDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="size-3 text-muted-foreground/70" />
                                <span>Due {formatDateIST(assignment.dueDate)}</span>
                              </span>
                            )}
                            {assignment.maxMarks && (
                              <span>• {assignment.maxMarks} marks</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isTeacher
                          ? renderTeacherBadge(assignment.id)
                          : renderStudentStatusBadge(assignment.id)}
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* =========================================================================
              STAGE 1: CLASSROOMS DIRECTORY (SELECT A SUBJECT TO VIEW PRACTICALS)
             ========================================================================= */
          <div className="flex flex-col gap-2.5 animate-in fade-in duration-150">
            {classroomsLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
                Loading academic classrooms...
              </div>
            ) : !classrooms || classrooms.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-border/80 bg-muted/20 text-center text-xs text-muted-foreground">
                No classroom workspaces found.
              </div>
            ) : (
              classrooms.map((room, idx) => {
                const theme = getClassroomTheme(room.id, idx);
                const isCurrentClassroom = currentClassroomId === room.id;

                return (
                  <div
                    key={room.id}
                    onClick={() => setSelectedClassroomId(room.id)}
                    className={`p-3.5 rounded-2xl border transition-all tap-feedback cursor-pointer flex items-center justify-between gap-3 ${
                      isCurrentClassroom
                        ? "border-primary/50 bg-primary/5 shadow-xs ring-1 ring-primary/20"
                        : "border-border/80 bg-card hover:border-border hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={cn(
                          "size-10 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0",
                          theme.badge
                        )}
                      >
                        <BookOpen className="size-5" />
                      </div>

                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={cn(
                              "px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase tracking-wider border",
                              theme.badge
                            )}
                          >
                            {room.subjectCode || "LAB"}
                          </span>
                          {room.division && (
                            <span className="text-[10px] font-medium text-muted-foreground">
                              Div {room.division}
                            </span>
                          )}
                          {isCurrentClassroom && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                              Active
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-sm tracking-tight text-foreground truncate">
                          {room.name}
                        </h4>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {room.department} • Semester {room.semester}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-primary hidden sm:inline">
                        View practicals
                      </span>
                      <div className="size-8 rounded-xl bg-muted/60 border border-border/60 flex items-center justify-center text-muted-foreground">
                        <ChevronRight className="size-4" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </MobileAdaptiveSheet>
  );
}
