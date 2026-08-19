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
  Loader2,
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
import { toast } from "@/lib/toast";
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

  const [activeTab, setActiveTab] = useState<"assignments" | "announcements" | "submissions" | "roster">("assignments");
  const [selectedBatch, setSelectedBatch] = useState<string>("ALL");
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [announcementBatch, setAnnouncementBatch] = useState<string>("");
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

  // 3.2 Fetch classroom announcements
  const { data: announcements, isLoading: announcementsLoading } = useQuery<any[]>({
    queryKey: ["announcements", classroomId],
    queryFn: () => api.get(`/classrooms/${classroomId}/announcements`),
  });

  // 3.5 Fetch classroom submissions for teacher
  const { data: submissions, isLoading: submissionsLoading } = useQuery<any[]>({
    queryKey: ["submissions", classroomId],
    queryFn: () => api.get(`/journals/classroom/${classroomId}/submissions`),
    enabled: !!user && user.role === "teacher" && activeTab === "submissions",
  });

  // Announcement posting mutation
  const postAnnouncementMutation = useMutation({
    mutationFn: (data: { title: string; content: string; targetBatch?: string }) =>
      api.post(`/classrooms/${classroomId}/announcements`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements", classroomId] });
      setShowAnnouncementModal(false);
      setAnnouncementTitle("");
      setAnnouncementContent("");
      setAnnouncementBatch("");
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to post announcement");
    },
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
      toast.error(err.message || "Failed to initialize document editing workspace");
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
      <header className="fixed top-4 left-16 sm:left-24 md:left-32 right-4 sm:right-8 md:right-16 z-40 flex items-center justify-between px-5 py-2.5 bg-gradient-to-b from-white/80 via-white/65 to-white/50 dark:from-zinc-900/85 dark:via-zinc-900/75 dark:to-zinc-950/70 backdrop-blur-2xl backdrop-saturate-180 border border-white/80 dark:border-white/15 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.1),_inset_0_1px_1px_0_rgba(255,255,255,0.95),_inset_0_-1px_1px_0_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7),_inset_0_1px_1px_0_rgba(255,255,255,0.18),_inset_0_-1px_1px_0_rgba(0,0,0,0.5)] rounded-2xl select-none transition-all duration-300">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 group select-none">
            <img
              src="/logo.png"
              alt="eJournal Icon"
              className="h-7 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <span className="font-bold text-base tracking-tight text-foreground">
              eJournal
            </span>
          </Link>
          <span className="text-muted-foreground/40 font-light">|</span>
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
        <div className="p-6 md:p-8 rounded-3xl glass-card relative overflow-hidden transition-all duration-300 flex flex-col gap-5">
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

            <div className="flex items-center gap-2 glass-pill p-2 rounded-2xl">
              <span className="text-xs font-semibold text-muted-foreground px-1">Join Code:</span>
              <code className="font-mono text-xs font-bold bg-background/80 px-2.5 py-1 rounded-xl border border-border text-foreground">
                {classroom.joinCode}
              </code>
              <button
                onClick={handleCopyCode}
                title="Copy join code"
                className="p-1.5 rounded-xl hover:bg-background/80 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                {copiedCode ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Tab switcher & Action bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
          <div className="flex items-center p-1.5 glass-pill rounded-2xl max-w-fit gap-1">
            <button
              onClick={() => setActiveTab("assignments")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === "assignments"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="size-3.5" />
              <span>Practicals ({assignments?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab("announcements")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === "announcements"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="size-3.5 text-amber-500" />
              <span>Announcements ({announcements?.length || 0})</span>
            </button>

            {isTeacher && (
              <button
                onClick={() => setActiveTab("submissions")}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  activeTab === "submissions"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <GraduationCap className="size-3.5 text-indigo-500" />
                <span>Submissions & Grading</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab("roster")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
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

          {isTeacher && activeTab === "announcements" && (
            <Button
              onClick={() => setShowAnnouncementModal(true)}
              size="sm"
              className="gap-1.5 text-xs font-semibold rounded-xl h-9 px-4 active:scale-95 transition-all duration-150 cursor-pointer glass-btn-amber"
            >
              <Plus className="size-3.5" />
              <span>Post Announcement</span>
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
        {activeTab === "announcements" ? (
          <div className="flex flex-col gap-4">
            {announcementsLoading ? (
              <div className="flex items-center justify-center p-12 glass-card rounded-3xl">
                <p className="text-sm text-muted-foreground animate-pulse">Loading classroom announcements...</p>
              </div>
            ) : announcements && announcements.length > 0 ? (
              <div className="flex flex-col gap-4">
                {announcements.map((ann: any) => (
                  <div key={ann.id} className="p-6 rounded-3xl glass-card flex flex-col gap-3 relative border border-amber-500/20">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xs">
                          {ann.authorName?.[0] || "T"}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground">{ann.authorName}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(ann.createdAt).toLocaleDateString()} at {new Date(ann.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      {ann.targetBatch && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                          {ann.targetBatch} Only
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-foreground">{ann.title}</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{ann.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center glass-card rounded-3xl gap-3">
                <Sparkles className="size-10 text-amber-500/50 mb-1" />
                <h3 className="text-base font-bold text-foreground">No Announcements Yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {isTeacher
                    ? "Post an announcement to notify students in your classroom or specific lab batches."
                    : "Your teacher hasn't posted any announcements for this classroom."}
                </p>
                {isTeacher && (
                  <Button
                    onClick={() => setShowAnnouncementModal(true)}
                    size="sm"
                    className="mt-2 text-xs font-semibold glass-btn-amber"
                  >
                    Post First Announcement
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : activeTab === "assignments" ? (
          <div className="flex flex-col gap-4">
            {assignments && assignments.length > 0 ? (
              assignments.map((asg) => {
                const relatedJournal = journals?.find((j) => j.assignmentId === asg.id);
                const jStatus = relatedJournal?.status;
                const isSubmitted = jStatus === "submitted";
                const isApproved = jStatus === "approved";
                const isChangesRequested = jStatus === "changes_requested";
                const isLocked = isSubmitted || isApproved;
                const hasMarks = isApproved && relatedJournal?.marks !== undefined && relatedJournal?.marks !== null;

                    return (
                      <div
                        key={asg.id}
                        className="group p-6 rounded-2xl glass-card hover:scale-[1.01] transition-all duration-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-5"
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

                          {/* Teacher Remarks Callout (Subtle Typographic Quote) */}
                          {isApproved && relatedJournal?.teacherRemarks && (
                            <div className="flex items-start gap-1.5 text-[11px] mt-0.5">
                              <span className="font-semibold text-muted-foreground shrink-0">Teacher Remarks:</span>
                              <span className="italic text-foreground/90 font-medium line-clamp-2">"{relatedJournal.teacherRemarks}"</span>
                            </div>
                          )}

                          {/* Annotation Breakdown Chips Row (Subtle Monochrome Badges) */}
                          {relatedJournal?.annotationCounts && Object.keys(relatedJournal.annotationCounts).length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-bold text-muted-foreground mr-0.5">Feedback:</span>
                              {Object.entries(relatedJournal.annotationCounts).map(([type, count]) => {
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
                                  <span key={type} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-muted/40 text-foreground border border-border/40 flex items-center gap-1">
                                    <span>{typeIcons[type] || "💬"}</span> {num} {type}{num > 1 ? "s" : ""}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-4 mt-1 text-[11px] font-medium text-muted-foreground">
                            {hasMarks ? (
                              <span className="flex items-center gap-1 text-foreground font-bold bg-muted/40 border border-border/50 px-2.5 py-0.5 rounded-md">
                                <Sparkles className="size-3 text-amber-500" /> Grade: {relatedJournal.marks} / {asg.maxMarks} ({Math.round((relatedJournal.marks / asg.maxMarks) * 100)}%)
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-foreground font-semibold">
                                <Sparkles className="size-3 text-amber-500" /> Max Marks: {asg.maxMarks}
                              </span>
                            )}
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
                                variant="outline"
                                size="sm"
                                className="font-semibold rounded-xl h-9 px-4 text-xs active:scale-95 transition-all duration-150 cursor-pointer md:self-center shrink-0"
                              >
                                <Link href={`/classrooms/${classroomId}/grades?assignment=${asg.id}`}>
                                  <span>Grade Submissions</span>
                                </Link>
                              </Button>
                            );
                          }

                          if (!relatedJournal) {
                            const isStartingThis = startJournalMutation.isPending && startJournalMutation.variables === asg.id;
                            return (
                              <Button
                                size="sm"
                                onClick={() => startJournalMutation.mutate(asg.id)}
                                disabled={startJournalMutation.isPending}
                                className="font-semibold rounded-xl h-9 px-4 text-xs active:scale-95 transition-all duration-150 cursor-pointer md:self-center shrink-0"
                              >
                                {isStartingThis ? (
                                  <span className="flex items-center gap-1.5">
                                    <Loader2 className="size-3.5 animate-spin" />
                                    <span>Starting...</span>
                                  </span>
                                ) : (
                                  <span>Start Journal</span>
                                )}
                              </Button>
                            );
                          }

                          const badgeClass = isSubmitted
                            ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                            : isApproved
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
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
                            <div className="flex items-center gap-3 md:self-center shrink-0">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border text-center ${badgeClass}`}>
                                {badgeLabel}
                              </span>
                              <Button
                                asChild
                                size="sm"
                                variant={isLocked ? "outline" : "default"}
                                className="font-semibold rounded-xl h-9 px-4 text-xs active:scale-95 transition-all duration-150 cursor-pointer"
                              >
                                <Link href={`/editor/${relatedJournal.id}`}>
                                  {isApproved ? "View Grade & Journal" : isLocked ? "Preview Journal" : "Resume Journal"}
                                </Link>
                              </Button>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })
                ) : (
              <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl glass-card">
                <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <FileText className="size-7" />
                </div>
                <h4 className="font-extrabold text-xl tracking-tight">No experiments published</h4>
                <p className="text-xs text-muted-foreground mt-1.5 text-center max-w-sm leading-relaxed">
                  {isTeacher
                    ? "Click 'Publish Experiment' above to create a new lab assignment for your students."
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
        ) : activeTab === "submissions" ? (
          <div className="flex flex-col gap-4">
            {/* Batch Filter Pills */}
            {classroom?.batches && classroom.batches.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs font-semibold text-muted-foreground mr-1">Batch Filter:</span>
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

            {submissionsLoading ? (
              <p className="text-xs text-muted-foreground animate-pulse font-medium">
                Loading student submissions...
              </p>
            ) : !submissions || submissions.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl glass-card">
                <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <GraduationCap className="size-7" />
                </div>
                <h4 className="font-extrabold text-xl tracking-tight">No submissions yet</h4>
                <p className="text-xs text-muted-foreground mt-1.5 text-center max-w-sm leading-relaxed">
                  Student hand-ins for your practical experiments will appear here for grading and evaluation.
                </p>
              </div>
            ) : (
              submissions
                .filter((sub) => selectedBatch === "ALL" || sub.studentBatch === selectedBatch || !sub.studentBatch)
                .map((sub) => (
                  <div
                    key={sub.id}
                    className="p-5 rounded-2xl glass-card flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:scale-[1.01] transition-all duration-300"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-primary/10 text-primary border border-primary/20">
                          Exp #{sub.experimentNumber}
                        </span>
                        <h4 className="font-bold text-sm text-foreground">
                          {sub.studentName} ({sub.enrollmentNumber || "No Enr."})
                        </h4>
                        {sub.studentBatch && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                            {sub.studentBatch}
                          </span>
                        )}
                        {sub.isRevoked && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/30 flex items-center gap-1">
                            ⚠️ Revoked Submission
                          </span>
                        )}
                        {(sub.isLate || sub.status === "late_submitted") && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-600 border border-rose-500/30">
                            Late Submission
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {sub.assignmentTitle} • {sub.submittedAt ? `Handed in ${new Date(sub.submittedAt).toLocaleDateString()}` : "In Progress"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
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
                          className="font-semibold rounded-xl h-8 px-3 text-xs opacity-60 cursor-not-allowed"
                        >
                          Revoked (Cannot Evaluate)
                        </Button>
                      ) : (
                        <Button
                          asChild
                          size="sm"
                          className="font-semibold rounded-xl h-8 px-3 text-xs active:scale-95 transition-all duration-150 cursor-pointer"
                        >
                          <Link href={`/editor/${sub.id}`}>
                            <span>{sub.status === "approved" ? "View Evaluation" : "Review Journal"}</span>
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))
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
                  className="p-4 rounded-2xl glass-card flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20 uppercase">
                      {(member.name || member.email || "S").substring(0, 2)}
                    </div>
                    <div className="flex flex-col">
                      <h4 className="font-bold text-sm text-foreground">
                        {member.name || member.email}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Enrollment: {member.enrollmentNumber} • Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl glass-card">
                <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <Users className="size-7" />
                </div>
                <h4 className="font-extrabold text-xl tracking-tight">No roster members yet</h4>
                <p className="text-xs text-muted-foreground mt-1.5 text-center max-w-sm leading-relaxed">
                  Students will appear here after they join your classroom using join code{" "}
                  <span className="font-mono font-bold text-foreground">{classroom.joinCode}</span>.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Publish Assignment Modal (Teacher only) */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
          <div className="glass-card w-full max-w-[500px] p-6 rounded-3xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
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

      {/* Publish Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
          <div className="w-full max-w-lg p-6 rounded-3xl glass-card flex flex-col gap-4 relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-amber-500" />
                <h3 className="text-lg font-bold text-foreground">Post Classroom Announcement</h3>
              </div>
              <button
                onClick={() => setShowAnnouncementModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Announcement Title</label>
                <input
                  type="text"
                  placeholder="e.g. Schedule for Batch A1 Practicals"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  className="h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {classroom?.batches && classroom.batches.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Target Batch (Optional)</label>
                  <select
                    value={announcementBatch}
                    onChange={(e) => setAnnouncementBatch(e.target.value)}
                    className="h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">All Batches (Entire Classroom)</option>
                    {classroom.batches.map((b: string) => (
                      <option key={b} value={b}>
                        {b} Only
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Content Message</label>
                <textarea
                  placeholder="Write your announcement details here..."
                  rows={4}
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  className="rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="flex items-center gap-3 justify-end mt-2">
                <Button type="button" variant="outline" onClick={() => setShowAnnouncementModal(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!announcementTitle.trim() || !announcementContent.trim()) {
                      setErrorMsg("Title and content are required");
                      return;
                    }
                    postAnnouncementMutation.mutate({
                      title: announcementTitle,
                      content: announcementContent,
                      targetBatch: announcementBatch || undefined,
                    });
                  }}
                  disabled={postAnnouncementMutation.isPending}
                  className="rounded-xl glass-btn-amber"
                >
                  {postAnnouncementMutation.isPending ? "Posting..." : "Post Announcement"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
