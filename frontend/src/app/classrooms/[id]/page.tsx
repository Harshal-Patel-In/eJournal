/**
 * Classroom Space View.
 *
 * Grounded in Apple HIG, Impeccable UI standards, and Emil Kowalski motion design.
 */

"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileEdit,
  FileText,
  GraduationCap,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";

const publishAssignmentSchema = zod.object({
  experimentNumber: zod.number().min(1, "Must be at least 1"),
  title: zod.string().min(2, "Title is required"),
  aim: zod.string().min(2, "Aim is required"),
  instructions: zod.string().min(2, "Instructions are required"),
  maxMarks: zod.number().min(1, "Marks must be positive").max(100, "Max 100 marks"),
  deadline: zod.string().min(1, "Deadline is required"),
});

type PublishAssignmentFields = zod.infer<typeof publishAssignmentSchema>;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClassroomPage({ params }: PageProps) {
  const { id: classroomId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"assignments" | "roster">("assignments");
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch user profile
  const { data: user } = useQuery<any>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile"),
  });

  // 2. Fetch classroom details
  const { data: classroom, isLoading: classroomLoading } = useQuery<any>({
    queryKey: ["classroom", classroomId],
    queryFn: () => api.get(`/classrooms/${classroomId}`),
  });

  // 3. Fetch classroom assignments
  const { data: assignments, isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: ["assignments", classroomId],
    queryFn: () => api.get(`/classrooms/${classroomId}/assignments`),
  });

  // 4. Fetch classroom members
  const { data: members, isLoading: membersLoading } = useQuery<any[]>({
    queryKey: ["members", classroomId],
    queryFn: () => api.get(`/classrooms/${classroomId}/members`),
    enabled: activeTab === "roster",
  });

  // 4.5 Fetch student's journals
  const { data: journals } = useQuery<any[]>({
    queryKey: ["student-journals"],
    queryFn: () => api.get("/journals"),
    enabled: !!user && user.role === "student",
  });

  // 5. Publish assignment mutation
  const publishMutation = useMutation({
    mutationFn: (data: any) =>
      api.post(`/classrooms/${classroomId}/assignments`, {
        ...data,
        deadline: new Date(data.deadline).toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments", classroomId] });
      setShowPublishModal(false);
      publishForm.reset();
    },
    onError: (error: any) => {
      setErrorMsg(error.message || "Failed to publish assignment");
    },
  });

  // 6. Start/Open student journal editor mutation
  const startJournalMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      api.post<any>("/journals", { assignmentId }),
    onSuccess: (data) => {
      router.push(`/editor/${data.id}`);
    },
    onError: (err: any) => {
      alert(err.message || "Failed to initialize document editing workspace");
    },
  });

  const publishForm = useForm<PublishAssignmentFields>({
    resolver: zodResolver(publishAssignmentSchema),
    defaultValues: {
      experimentNumber: 1,
      maxMarks: 20,
    },
  });

  const handleCopyCode = () => {
    if (classroom?.joinCode) {
      navigator.clipboard.writeText(classroom.joinCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (classroomLoading || assignmentsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse text-sm font-medium">
          Loading classroom space...
        </p>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <h3 className="font-bold text-xl">Classroom not found</h3>
        <Button asChild className="mt-4 rounded-xl">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const isTeacher = user?.role === "teacher";

  return (
    <div className="min-h-screen bg-slate-100/60 dark:bg-zinc-950 bg-textured-workspace text-foreground flex flex-col">
      {/* 1. Floating Circular Back Button */}
      <div className="fixed top-4 left-4 sm:left-8 md:left-16 z-40 select-none">
        <Link
          href="/dashboard"
          title="Back to Dashboard"
          className="flex items-center justify-center size-9 rounded-full bg-gradient-to-b from-white/80 via-white/60 to-white/40 dark:from-zinc-900/90 dark:via-zinc-900/85 dark:to-zinc-950/80 backdrop-blur-2xl backdrop-saturate-180 border border-white/80 dark:border-zinc-700/60 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.1)] text-muted-foreground hover:text-foreground hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          <ArrowLeft className="size-4" />
        </Link>
      </div>

      {/* 2. Floating Capsule Header Bar */}
      <header className="fixed top-4 left-16 sm:left-24 md:left-32 right-4 sm:right-8 md:right-16 z-40 flex items-center justify-between px-5 py-2.5 bg-gradient-to-b from-white/85 via-white/70 to-white/50 dark:from-zinc-900/95 dark:via-zinc-900/90 dark:to-zinc-950/85 backdrop-blur-2xl backdrop-saturate-180 border border-white/80 dark:border-zinc-700/60 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.1)] rounded-2xl select-none transition-all duration-200">
        <div className="flex items-center gap-3">
          <span className="font-bold text-base tracking-tight">{classroom.name}</span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <NotificationBell />
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted/80 text-foreground border border-border uppercase">
            {classroom.subject}
          </span>
        </div>
      </header>

      {/* Subject Space Container */}
      <main className="max-w-4xl w-full mx-auto p-6 md:p-8 pt-24 md:pt-24 flex flex-col gap-6 relative z-10">
        {/* Banner Section */}
        <div className="p-6 md:p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                  <BookOpen className="size-3" />
                  {classroom.subject}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  Semester {classroom.semester} • Div {classroom.division}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground mt-1">
                {classroom.name}
              </h1>
              <p className="text-xs font-medium text-muted-foreground">
                {classroom.department}
              </p>
            </div>

            <div className="flex items-center gap-2 bg-muted/40 p-2 rounded-xl border border-border">
              <span className="text-xs font-semibold text-muted-foreground px-1">Join Code:</span>
              <code className="font-mono text-xs font-bold bg-background px-2.5 py-1 rounded-lg border border-border text-foreground">
                {classroom.joinCode}
              </code>
              <button
                onClick={handleCopyCode}
                title="Copy join code"
                className="p-1.5 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                {copiedCode ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Tab switcher & Action bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
          <div className="flex items-center p-1 bg-muted/60 dark:bg-zinc-900/60 rounded-xl border border-border/60 max-w-fit">
            <button
              onClick={() => setActiveTab("assignments")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "assignments"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="size-3.5" />
              <span>Practicals & Experiments ({assignments?.length || 0})</span>
            </button>
            <button
              onClick={() => setActiveTab("roster")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "roster"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="size-3.5" />
              <span>Roster Members</span>
            </button>
          </div>

          {isTeacher && activeTab === "assignments" && (
            <Button
              onClick={() => setShowPublishModal(true)}
              size="sm"
              className="gap-1.5 text-xs font-semibold rounded-xl h-9 px-4 active:scale-95 transition-all duration-150 cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Publish Experiment</span>
            </Button>
          )}
        </div>

        {/* Error Messaging */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20 max-w-md">
            {errorMsg}
          </div>
        )}

        {/* Tab View Components */}
        {activeTab === "assignments" ? (
          <div className="flex flex-col gap-4">
            {assignments && assignments.length > 0 ? (
              assignments.map((asg) => (
                <div
                  key={asg.id}
                  className="group p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/95 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08)] transition-all duration-200 flex flex-col sm:flex-row justify-between sm:items-center gap-5"
                >
                  <div className="flex flex-col gap-2 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono uppercase bg-primary/10 text-primary border border-primary/20">
                        Exp #{asg.experimentNumber}
                      </span>
                      <h4 className="font-extrabold text-lg tracking-tight text-foreground group-hover:text-primary transition-colors">
                        {asg.title}
                      </h4>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground leading-relaxed line-clamp-2">
                      {asg.aim}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 mt-1 text-[11px] font-medium text-muted-foreground">
                      <span className="flex items-center gap-1 text-foreground font-semibold">
                        <Sparkles className="size-3 text-amber-500" /> Max Marks: {asg.maxMarks}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3 text-muted-foreground/70" /> Deadline: {new Date(asg.deadline).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {(() => {
                    if (isTeacher) {
                      return (
                        <Button
                          asChild
                          size="sm"
                          className="sm:self-center font-semibold rounded-xl h-9 px-4 active:scale-95 transition-all duration-150 cursor-pointer shrink-0"
                        >
                          <Link href={`/classrooms/${classroomId}/grades?assignment=${asg.id}`}>
                            <span>Grade Submissions</span>
                          </Link>
                        </Button>
                      );
                    }

                    const relatedJournal = journals?.find((j) => j.assignmentId === asg.id);
                    if (relatedJournal) {
                      const jStatus = relatedJournal.status;
                      const isSubmitted = jStatus === "submitted";
                      const isApproved = jStatus === "approved";
                      const isChangesRequested = jStatus === "changes_requested";
                      const isLocked = isSubmitted || isApproved;

                      const badgeClass = isSubmitted
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : isApproved
                        ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                        : isChangesRequested
                        ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                        : "bg-amber-500/10 text-amber-600 border-amber-500/20";

                      const badgeLabel = isSubmitted
                        ? "Handed In"
                        : isApproved
                        ? "Approved"
                        : isChangesRequested
                        ? "Changes Requested"
                        : "In Progress";

                      return (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:self-center shrink-0">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border text-center ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                          <Button
                            asChild
                            size="sm"
                            variant={isLocked ? "outline" : "default"}
                            className="font-semibold rounded-xl h-9 px-4 active:scale-95 transition-all duration-150 cursor-pointer"
                          >
                            <Link href={`/editor/${relatedJournal.id}`}>
                              {isLocked ? "Preview Journal" : "Resume Journal"}
                            </Link>
                          </Button>
                        </div>
                      );
                    }

                    return (
                      <Button
                        size="sm"
                        className="sm:self-center font-semibold rounded-xl h-9 px-4 active:scale-95 transition-all duration-150 cursor-pointer shrink-0"
                        onClick={() => startJournalMutation.mutate(asg.id)}
                        disabled={startJournalMutation.isPending}
                      >
                        <FileEdit className="size-3.5 mr-1.5" />
                        <span>{startJournalMutation.isPending ? "Opening..." : "Start Journal"}</span>
                      </Button>
                    );
                  })()}
                </div>
              ))
            ) : (
              <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl bg-white/80 dark:bg-zinc-900/80 shadow-xs">
                <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <FileText className="size-7" />
                </div>
                <h4 className="font-extrabold text-xl tracking-tight">No experiments published</h4>
                <p className="text-xs text-muted-foreground mt-1.5 text-center max-w-sm leading-relaxed">
                  {isTeacher
                    ? "Publish your first lab practical experiment by clicking 'Publish Experiment' above."
                    : "Your teacher hasn't published any lab assignments in this workspace yet."}
                </p>
                {isTeacher && (
                  <Button
                    onClick={() => setShowPublishModal(true)}
                    size="sm"
                    className="mt-4 rounded-xl"
                  >
                    Publish Experiment Now
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {membersLoading ? (
              <p className="text-xs text-muted-foreground animate-pulse font-medium">
                Loading roster members...
              </p>
            ) : members && members.length > 0 ? (
              members.map((member) => (
                <div
                  key={member.studentId}
                  className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/95 shadow-xs flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20 uppercase">
                      {(member.name || member.email || "S").substring(0, 2)}
                    </div>
                    <div className="flex flex-col">
                      <h4 className="font-bold text-sm text-foreground">
                        {member.name || "Awaiting Profile setup"}
                      </h4>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 capitalize border border-emerald-500/20">
                    {member.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl bg-white/80 dark:bg-zinc-900/80 shadow-xs">
                <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <Users className="size-7" />
                </div>
                <h4 className="font-extrabold text-xl tracking-tight">No students enrolled</h4>
                <p className="text-xs text-muted-foreground mt-1.5 text-center max-w-sm leading-relaxed">
                  Share the join code <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground font-bold">{classroom.joinCode}</code> to enroll students into this workspace.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Publish Assignment Modal (Teacher only) */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-card w-full max-w-[500px] p-6 rounded-2xl border border-border shadow-xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-xl tracking-tight">Publish Practical Assignment</h3>
            <form
              onSubmit={publishForm.handleSubmit((data) => publishMutation.mutate(data))}
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Experiment #</label>
                  <input
                    type="number"
                    className="h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    {...publishForm.register("experimentNumber", { valueAsNumber: true })}
                  />
                  {publishForm.formState.errors.experimentNumber && (
                    <span className="text-xs text-destructive">
                      {publishForm.formState.errors.experimentNumber.message}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Max Marks</label>
                  <input
                    type="number"
                    className="h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    {...publishForm.register("maxMarks", { valueAsNumber: true })}
                  />
                  {publishForm.formState.errors.maxMarks && (
                    <span className="text-xs text-destructive">
                      {publishForm.formState.errors.maxMarks.message}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Verification of Ohm's Law"
                  className="h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...publishForm.register("title")}
                />
                {publishForm.formState.errors.title && (
                  <span className="text-xs text-destructive">{publishForm.formState.errors.title.message}</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Experiment Aim</label>
                <textarea
                  placeholder="To determine..."
                  rows={2}
                  className="rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...publishForm.register("aim")}
                />
                {publishForm.formState.errors.aim && (
                  <span className="text-xs text-destructive">{publishForm.formState.errors.aim.message}</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Instructions & Procedure</label>
                <textarea
                  placeholder="Step 1..."
                  rows={3}
                  className="rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...publishForm.register("instructions")}
                />
                {publishForm.formState.errors.instructions && (
                  <span className="text-xs text-destructive">{publishForm.formState.errors.instructions.message}</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Cut-off Deadline</label>
                <input
                  type="datetime-local"
                  className="h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...publishForm.register("deadline")}
                />
                {publishForm.formState.errors.deadline && (
                  <span className="text-xs text-destructive">{publishForm.formState.errors.deadline.message}</span>
                )}
              </div>

              <div className="flex items-center gap-3 justify-end mt-2">
                <Button type="button" variant="outline" onClick={() => setShowPublishModal(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={publishMutation.isPending} className="rounded-xl">
                  {publishMutation.isPending ? "Publishing..." : "Publish Assignment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
