/**
 * Classroom Space View.
 *
 * Grounded in Apple HIG, Impeccable UI standards, and Emil Kowalski motion design.
 */

"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Edit2,
  FileEdit,
  FileText,
  Folder,
  FolderPlus,
  FolderX,
  GraduationCap,
  Layers,
  LayoutGrid,
  Loader2,
  MoreVertical,
  Plus,
  Sparkles,
  Square,
  Trash2,
  Users,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";

import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { formatDateIST, formatDateTimeIST } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { GlassDropdown } from "@/components/ui/glass-dropdown";
import NotificationBell from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";

const publishAssignmentSchema = zod.object({
  experimentNumber: zod.number().min(1, "Must be at least 1"),
  title: zod.string().min(2, "Title is required"),
  aim: zod.string().min(2, "Aim is required"),
  instructions: zod.string().min(2, "Instructions are required"),
  maxMarks: zod.number().min(1, "Marks must be positive").max(100, "Max 100 marks"),
  deadline: zod.string().min(1, "Deadline is required"),
  clusterName: zod.string().optional(),
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
  const [selectedDivision, setSelectedDivision] = useState<string>("ALL");
  const [selectedBatch, setSelectedBatch] = useState<string>("ALL");
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showClusterModal, setShowClusterModal] = useState(false);
  const [newClusterName, setNewClusterName] = useState("");
  const [openCardMenuId, setOpenCardMenuId] = useState<string | null>(null);
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
      queryClient.invalidateQueries({ queryKey: ["gradebook", classroomId] });
      queryClient.invalidateQueries({ queryKey: ["submissions", classroomId] });
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

  // 7. Cluster Mutations
  const updateClusterMutation = useMutation({
    mutationFn: ({ assignmentId, clusterName }: { assignmentId: string; clusterName: string | null }) =>
      api.patch(`/classrooms/${classroomId}/assignments/${assignmentId}/cluster`, { clusterName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments", classroomId] });
      queryClient.invalidateQueries({ queryKey: ["gradebook", classroomId] });
      queryClient.invalidateQueries({ queryKey: ["submissions", classroomId] });
      toast.success("Practical cluster updated");
      setOpenCardMenuId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update cluster");
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: ({ assignmentIds, clusterName }: { assignmentIds: string[]; clusterName: string | null }) =>
      api.post(`/classrooms/${classroomId}/clusters/bulk-assign`, { assignmentIds, clusterName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments", classroomId] });
      queryClient.invalidateQueries({ queryKey: ["gradebook", classroomId] });
      queryClient.invalidateQueries({ queryKey: ["submissions", classroomId] });
      setSelectedAssignmentIds([]);
      toast.success("Batch updated practical clusters");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to bulk assign cluster");
    },
  });

  const disbandClusterMutation = useMutation({
    mutationFn: (clusterName: string) =>
      api.post(`/classrooms/${classroomId}/clusters/disband`, { clusterName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments", classroomId] });
      queryClient.invalidateQueries({ queryKey: ["gradebook", classroomId] });
      queryClient.invalidateQueries({ queryKey: ["submissions", classroomId] });
      toast.success("Cluster disbanded. Experiments returned to Unclustered.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to disband cluster");
    },
  });

  // Calculate unique divisions
  const availableDivisions = useMemo(() => {
    const divs = new Set<string>();
    if (classroom?.division) divs.add(classroom.division);
    if (classroom?.divisions && Array.isArray(classroom.divisions)) {
      classroom.divisions.forEach((d: string) => divs.add(d));
    }
    if (members && Array.isArray(members)) {
      members.forEach((m: any) => {
        if (m.division) divs.add(m.division);
      });
    }
    if (submissions && Array.isArray(submissions)) {
      submissions.forEach((s: any) => {
        if (s.studentDivision) divs.add(s.studentDivision);
      });
    }
    return Array.from(divs).sort();
  }, [classroom, members, submissions]);

  // Group assignments by cluster
  const clusterGroups = useMemo(() => {
    if (!assignments) return { clusters: {} as Record<string, any[]>, unclustered: [] as any[] };
    const clusters: Record<string, any[]> = {};
    const unclustered: any[] = [];

    for (const asg of assignments) {
      const c = asg.clusterName?.trim();
      if (c) {
        if (!clusters[c]) clusters[c] = [];
        clusters[c].push(asg);
      } else {
        unclustered.push(asg);
      }
    }

    Object.values(clusters).forEach((list) => list.sort((a, b) => a.experimentNumber - b.experimentNumber));
    unclustered.sort((a, b) => a.experimentNumber - b.experimentNumber);

    return { clusters, unclustered };
  }, [assignments]);

  const existingClusterNames = useMemo(() => {
    return Object.keys(clusterGroups.clusters);
  }, [clusterGroups.clusters]);

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

  const isTeacher = user?.role === "teacher";

  const renderAssignmentCard = (asg: any) => {
    const relatedJournal = journals?.find((j) => j.assignmentId === asg.id);
    const jStatus = relatedJournal?.status;
    const isSubmitted = jStatus === "submitted";
    const isLateSubmitted = jStatus === "late_submitted";
    const isApproved = jStatus === "approved";
    const isChangesRequested = jStatus === "changes_requested";
    const isLocked = isSubmitted || isLateSubmitted || isApproved;
    const hasMarks = isApproved && relatedJournal?.marks !== undefined && relatedJournal?.marks !== null;
    const isSelected = selectedAssignmentIds.includes(asg.id);
    const isMenuOpen = openCardMenuId === asg.id;

    return (
      <div
        key={asg.id}
        className={`group p-5 rounded-2xl glass-card hover:scale-[1.005] transition-all duration-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
          isMenuOpen ? "relative z-30" : "relative z-0"
        } ${isSelected ? "ring-2 ring-primary/40 bg-primary/[0.03]" : ""}`}
      >
        <div className="flex items-start gap-3 max-w-xl">
          {/* Checkbox for teacher bulk actions */}
          {isTeacher && (
            <button
              type="button"
              onClick={() => {
                setSelectedAssignmentIds((prev) =>
                  prev.includes(asg.id) ? prev.filter((id) => id !== asg.id) : [...prev, asg.id]
                );
              }}
              className="mt-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
              title={isSelected ? "Deselect" : "Select for bulk cluster action"}
            >
              {isSelected ? (
                <CheckSquare className="size-4 text-primary" />
              ) : (
                <Square className="size-4 text-muted-foreground/60" />
              )}
            </button>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono uppercase bg-primary/10 text-primary border border-primary/20">
                Exp #{asg.experimentNumber}
              </span>
              {isTeacher && asg.clusterName && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center gap-1">
                  <Folder className="size-2.5" />
                  {asg.clusterName}
                </span>
              )}
              <h4 className="font-extrabold text-base tracking-tight text-foreground group-hover:text-primary transition-colors">
                {asg.title}
              </h4>
            </div>
            <p className="text-xs font-medium text-muted-foreground leading-relaxed line-clamp-2">
              {asg.aim}
            </p>

            {/* Teacher Remarks Callout */}
            {isApproved && relatedJournal?.teacherRemarks && (
              <div className="flex items-start gap-1.5 text-[11px] mt-0.5">
                <span className="font-semibold text-muted-foreground shrink-0">Teacher Remarks:</span>
                <span className="italic text-foreground/90 font-medium line-clamp-2">"{relatedJournal.teacherRemarks}"</span>
              </div>
            )}

            {/* Annotation Breakdown Chips Row */}
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

            <div className="flex flex-wrap items-center gap-4 mt-0.5 text-[11px] font-medium text-muted-foreground">
              {hasMarks ? (
                <span className="flex items-center gap-1 text-foreground font-bold bg-muted/40 border border-border/50 px-2 py-0.5 rounded-md">
                  <Sparkles className="size-3 text-amber-500" /> Grade: {relatedJournal.marks} / {asg.maxMarks} ({Math.round((relatedJournal.marks / asg.maxMarks) * 100)}%)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-foreground font-semibold">
                  <Sparkles className="size-3 text-amber-500" /> Max Marks: {asg.maxMarks}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="size-3 text-muted-foreground/70" /> Deadline: {formatDateIST(asg.deadline)}
              </span>
            </div>
          </div>
        </div>

        {/* Card Actions */}
        <div className="flex items-center gap-2 md:self-center shrink-0">
          {isTeacher ? (
            <div className="flex items-center gap-2 relative">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="font-semibold rounded-xl h-8 px-3 text-xs active:scale-95 transition-all duration-150 cursor-pointer"
              >
                <Link href={`/classrooms/${classroomId}/grades?assignment=${asg.id}`}>
                  <span>Grade Submissions</span>
                </Link>
              </Button>

              {/* In-place Cluster Move Menu */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpenCardMenuId(openCardMenuId === asg.id ? null : asg.id)}
                  className="size-8 p-0 rounded-xl cursor-pointer"
                  title="Cluster Options"
                >
                  <MoreVertical className="size-3.5 text-muted-foreground" />
                </Button>

                {openCardMenuId === asg.id && (
                  <div className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl bg-popover/98 dark:bg-zinc-900/98 backdrop-blur-2xl border border-border/80 shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/10 dark:ring-white/10">
                    <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Assign to Cluster
                    </span>

                    {/* Uncluster option */}
                    <button
                      type="button"
                      onClick={() => updateClusterMutation.mutate({ assignmentId: asg.id, clusterName: null })}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-accent transition-colors text-left cursor-pointer"
                    >
                      <span>None (Unclustered)</span>
                      {!asg.clusterName && <Check className="size-3 text-primary" />}
                    </button>

                    {/* Existing clusters */}
                    {existingClusterNames.map((cName) => (
                      <button
                        key={cName}
                        type="button"
                        onClick={() => updateClusterMutation.mutate({ assignmentId: asg.id, clusterName: cName })}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-accent transition-colors text-left cursor-pointer"
                      >
                        <span className="truncate">{cName}</span>
                        {asg.clusterName === cName && <Check className="size-3 text-primary" />}
                      </button>
                    ))}

                    <div className="my-1 border-t border-border/40" />

                    <button
                      type="button"
                      onClick={() => {
                        setOpenCardMenuId(null);
                        setSelectedAssignmentIds([asg.id]);
                        setShowClusterModal(true);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors text-left cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      <span>Create New Cluster...</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : !relatedJournal ? (
            <Button
              size="sm"
              onClick={() => startJournalMutation.mutate(asg.id)}
              disabled={startJournalMutation.isPending}
              className="font-semibold rounded-xl h-8 px-3 text-xs active:scale-95 transition-all duration-150 cursor-pointer"
            >
              {startJournalMutation.isPending && startJournalMutation.variables === asg.id ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin" />
                  <span>Starting...</span>
                </span>
              ) : (
                <span>Start Journal</span>
              )}
            </Button>
          ) : (
            <div className="flex items-center gap-2.5">
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border text-center ${
                  isApproved
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : isLateSubmitted
                    ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                    : isSubmitted
                    ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                    : isChangesRequested
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                }`}
              >
                {isApproved
                  ? "Approved"
                  : isLateSubmitted
                  ? "Late Submitted"
                  : isSubmitted
                  ? "Handed In"
                  : isChangesRequested
                  ? "Changes Requested"
                  : "In Progress"}
              </span>
              <Button
                asChild
                size="sm"
                variant={isLocked ? "outline" : "default"}
                className="font-semibold rounded-xl h-8 px-3.5 text-xs active:scale-95 transition-all duration-150 cursor-pointer"
              >
                <Link href={`/editor/${relatedJournal.id}`}>
                  {isApproved ? "View Grade & Journal" : isLocked ? "Preview Journal" : "Resume Journal"}
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    );
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
          <Link href="/profile" title="View & Edit Academic Profile">
            <div className="size-7 rounded-full bg-primary/15 text-primary border border-primary/25 hover:border-primary/50 flex items-center justify-center font-bold text-xs cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-2xs">
              <User className="size-3.5" />
            </div>
          </Link>
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
          {/* Segmented Control Pill (Locked Height, Zero-Jitter, No Scrollbar) */}
          <div className="flex items-center p-1 glass-pill rounded-2xl max-w-fit gap-1 shrink-0">
            <button
              onClick={() => setActiveTab("assignments")}
              className={`flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "assignments"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className={`size-3.5 ${activeTab === "assignments" ? "text-primary" : "text-muted-foreground"}`} />
              <span>Practicals</span>
              <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold ${
                activeTab === "assignments" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {assignments?.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("announcements")}
              className={`flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "announcements"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className={`size-3.5 ${activeTab === "announcements" ? "text-amber-500" : "text-muted-foreground"}`} />
              <span>Announcements</span>
              <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold ${
                activeTab === "announcements" ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"
              }`}>
                {announcements?.length || 0}
              </span>
            </button>

            {isTeacher && (
              <button
                onClick={() => setActiveTab("submissions")}
                className={`flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "submissions"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <GraduationCap className={`size-3.5 ${activeTab === "submissions" ? "text-indigo-500" : "text-muted-foreground"}`} />
                <span>Gradebook</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab("roster")}
              className={`flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "roster"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className={`size-3.5 ${activeTab === "roster" ? "text-primary" : "text-muted-foreground"}`} />
              <span>Members</span>
            </button>
          </div>

          {/* Contextual Action Group (Visually Stable on Every Tab) */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* When on Practicals: Download Journal & Publish Experiment */}
            {activeTab === "assignments" && (
              <>
                <Link href={`/classrooms/${classroomId}/compile-journal`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs font-bold rounded-xl h-9 px-3.5 active:scale-95 transition-all cursor-pointer bg-primary/5 hover:bg-primary/10 text-primary border-primary/25 shadow-2xs whitespace-nowrap"
                    title="Compile all practical experiments into an official master lab manual"
                  >
                    <BookOpen className="size-3.5" />
                    <span>Download Complete Journal</span>
                  </Button>
                </Link>

                {isTeacher && (
                  <>
                    <Button
                      onClick={() => setShowClusterModal(true)}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs font-semibold rounded-xl h-9 px-3.5 active:scale-95 transition-all cursor-pointer whitespace-nowrap border-border/80"
                      title="Manage experiment clusters and cycles"
                    >
                      <Layers className="size-3.5 text-indigo-500" />
                      <span>Manage Clusters</span>
                    </Button>

                    <Button
                      onClick={() => setShowPublishModal(true)}
                      size="sm"
                      className="gap-1.5 text-xs font-semibold rounded-xl h-9 px-4 active:scale-95 transition-all duration-150 cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="size-3.5" />
                      <span>Publish Experiment</span>
                    </Button>
                  </>
                )}
              </>
            )}

            {/* When on Announcements: Post Announcement */}
            {activeTab === "announcements" && isTeacher && (
              <Button
                onClick={() => setShowAnnouncementModal(true)}
                size="sm"
                className="gap-1.5 text-xs font-semibold rounded-xl h-9 px-4 active:scale-95 transition-all duration-150 cursor-pointer glass-btn-amber whitespace-nowrap"
              >
                <Plus className="size-3.5" />
                <span>Post Announcement</span>
              </Button>
            )}

            {/* When on Gradebook (Submissions): Full Gradebook Matrix link */}
            {activeTab === "submissions" && isTeacher && (
              <Link href={`/classrooms/${classroomId}/grades`}>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs font-semibold rounded-xl h-9 px-3.5 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                >
                  <LayoutGrid className="size-3.5" />
                  <span>Full Gradebook Matrix</span>
                </Button>
              </Link>
            )}

            {/* When on Members (Roster): Copy Join Code quick action */}
            {activeTab === "roster" && (
              <Button
                onClick={handleCopyCode}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-semibold rounded-xl h-9 px-3.5 active:scale-95 transition-all cursor-pointer whitespace-nowrap border-border/80"
                title="Copy student join code"
              >
                {copiedCode ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5 text-muted-foreground" />}
                <span>{copiedCode ? "Code Copied!" : `Copy Code: ${classroom?.joinCode || ""}`}</span>
              </Button>
            )}
          </div>
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
                            {formatDateTimeIST(ann.createdAt, false)}
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
          <div className="flex flex-col gap-6">
            {assignments && assignments.length > 0 ? (
              isTeacher ? (
                <>
                  {/* 1. Render Grouped Clusters (Teacher Only) */}
                  {existingClusterNames.map((cName) => {
                    const cAssignments = clusterGroups.clusters[cName];
                    return (
                      <div
                        key={cName}
                        className="flex flex-col gap-3 p-5 rounded-3xl glass-card border border-indigo-500/20 bg-indigo-500/[0.02]"
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap pb-2 border-b border-indigo-500/15">
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">
                              <Folder className="size-4" />
                            </div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-extrabold text-base tracking-tight text-foreground">{cName}</h3>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                                {cAssignments.length} {cAssignments.length === 1 ? "Practical" : "Practicals"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => disbandClusterMutation.mutate(cName)}
                              disabled={disbandClusterMutation.isPending}
                              className="text-xs text-muted-foreground hover:text-destructive h-8 px-2.5 rounded-lg cursor-pointer"
                              title="Disband cluster (experiments become unclustered)"
                            >
                              <FolderX className="size-3.5 mr-1" />
                              <span>Disband Cluster</span>
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3">
                          {cAssignments.map((asg) => renderAssignmentCard(asg))}
                        </div>
                      </div>
                    );
                  })}

                  {/* 2. Render Unclustered Experiments (Teacher Only) */}
                  {clusterGroups.unclustered.length > 0 && (
                    <div className="flex flex-col gap-3">
                      {existingClusterNames.length > 0 && (
                        <div className="flex items-center gap-2 px-1">
                          <FileText className="size-4 text-muted-foreground" />
                          <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                            Unclustered Experiments ({clusterGroups.unclustered.length})
                          </h4>
                        </div>
                      )}
                      <div className="flex flex-col gap-3">
                        {clusterGroups.unclustered.map((asg) => renderAssignmentCard(asg))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Flat Sequential List for Students (Zero Cluster Clutter) */
                <div className="flex flex-col gap-3">
                  {[...assignments]
                    .sort((a, b) => a.experimentNumber - b.experimentNumber)
                    .map((asg) => renderAssignmentCard(asg))}
                </div>
              )
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
            {/* Division & Batch Filter Strip */}
            <div className="flex flex-col gap-2.5 pb-1">
              {/* Division Filter */}
              {availableDivisions.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-xs font-semibold text-muted-foreground mr-1">Division:</span>
                  <button
                    onClick={() => setSelectedDivision("ALL")}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedDivision === "ALL"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "glass-pill text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All Divisions
                  </button>
                  {availableDivisions.map((d: string) => (
                    <button
                      key={d}
                      onClick={() => setSelectedDivision(d)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedDivision === d
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "glass-pill text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Division {d}
                    </button>
                  ))}
                </div>
              )}

              {/* Batch Filter Pills */}
              {classroom?.batches && classroom.batches.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-xs font-semibold text-muted-foreground mr-1">Batch:</span>
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
            </div>

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
                .filter((sub) => {
                  const matchBatch = selectedBatch === "ALL" || sub.studentBatch === selectedBatch || !sub.studentBatch;
                  const matchDivision = selectedDivision === "ALL" || sub.studentDivision === selectedDivision || !sub.studentDivision;
                  return matchBatch && matchDivision;
                })
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
                        {sub.assignmentTitle} • {sub.submittedAt ? `Handed in ${formatDateIST(sub.submittedAt)}` : "In Progress"}
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
                        Enrollment: {member.enrollmentNumber} • Joined {formatDateIST(member.joinedAt)}
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

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Cluster / Lab Cycle (Optional)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Cluster 1: DC Circuits (leave blank for Unclustered)"
                    list="cluster-suggestions"
                    className="h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex-1"
                    {...publishForm.register("clusterName")}
                  />
                  <datalist id="cluster-suggestions">
                    {existingClusterNames.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
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
                className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 rounded-lg cursor-pointer"
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
                  <GlassDropdown
                    value={announcementBatch}
                    onChange={(val) => setAnnouncementBatch(val)}
                    placeholder="All Batches (Entire Classroom)"
                    options={[
                      { value: "", label: "All Batches (Entire Classroom)" },
                      ...classroom.batches.map((b: string) => ({
                        value: b,
                        label: `${b} Only`,
                        badge: b,
                      })),
                    ]}
                    className="w-full"
                    buttonClassName="h-10 px-3 rounded-xl bg-background"
                    renderMath={false}
                  />
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

      {/* Cluster Manager Modal */}
      {showClusterModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
          <div className="glass-card w-full max-w-lg p-6 rounded-3xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="size-5 text-indigo-500" />
                <h3 className="font-bold text-lg tracking-tight">Manage Practical Clusters</h3>
              </div>
              <button
                onClick={() => setShowClusterModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Clusters group practical experiments into evaluation modules or continuous assessment cycles.
              Disbanding a cluster never deletes student journals or marks; it simply returns the practicals to standalone status.
            </p>

            {/* Existing Clusters List */}
            <div className="flex flex-col gap-2.5 mt-1">
              {existingClusterNames.length === 0 ? (
                <div className="p-6 text-center rounded-2xl border border-dashed border-border/60 text-xs text-muted-foreground">
                  No clusters created yet. Use the card action menu or the form below to create your first cluster.
                </div>
              ) : (
                existingClusterNames.map((cName) => {
                  const count = clusterGroups.clusters[cName]?.length || 0;
                  return (
                    <div
                      key={cName}
                      className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <Folder className="size-4 text-indigo-500 shrink-0" />
                        <div>
                          <h4 className="text-sm font-bold text-foreground">{cName}</h4>
                          <span className="text-[11px] text-muted-foreground">
                            {count} {count === 1 ? "Experiment" : "Experiments"}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => disbandClusterMutation.mutate(cName)}
                        disabled={disbandClusterMutation.isPending}
                        className="text-xs text-destructive hover:bg-destructive/10 h-8 px-3 rounded-xl cursor-pointer"
                      >
                        <FolderX className="size-3.5 mr-1" />
                        Disband
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Create New Cluster Row */}
            <div className="flex flex-col gap-2 pt-3 border-t border-border/40">
              <label className="text-xs font-semibold text-muted-foreground">Create New Cluster Name</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. Cycle 1: DC Circuits & Network Theorems"
                  value={newClusterName}
                  onChange={(e) => setNewClusterName(e.target.value)}
                  className="flex-1 h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const trimmed = newClusterName.trim();
                    if (!trimmed) return;
                    if (selectedAssignmentIds.length > 0) {
                      bulkAssignMutation.mutate({ assignmentIds: selectedAssignmentIds, clusterName: trimmed });
                    } else {
                      toast.info(`Cluster "${trimmed}" prepared! Now assign practicals to it via the card menu.`);
                    }
                    setNewClusterName("");
                    setShowClusterModal(false);
                  }}
                  disabled={!newClusterName.trim()}
                  className="h-10 px-4 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Create
                </Button>
              </div>
            </div>

            <div className="flex justify-end mt-2">
              <Button variant="outline" size="sm" onClick={() => setShowClusterModal(false)} className="rounded-xl cursor-pointer">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Multi-Select Bulk Action Bar for Teachers */}
      {isTeacher && selectedAssignmentIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/95 dark:bg-zinc-800/95 text-white backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <span className="text-xs font-bold whitespace-nowrap">
            {selectedAssignmentIds.length} {selectedAssignmentIds.length === 1 ? "Experiment" : "Experiments"} Selected
          </span>

          <div className="h-4 w-px bg-white/20" />

          <div className="flex items-center gap-2">
            <GlassDropdown
              value=""
              placeholder="Move to Cluster..."
              options={[
                { value: "UNCLUSTER", label: "None (Uncluster)" },
                ...existingClusterNames.map((c) => ({
                  value: c,
                  label: c,
                })),
              ]}
              onChange={(val) => {
                if (val === "UNCLUSTER") {
                  bulkAssignMutation.mutate({ assignmentIds: selectedAssignmentIds, clusterName: null });
                } else if (val) {
                  bulkAssignMutation.mutate({ assignmentIds: selectedAssignmentIds, clusterName: val });
                }
              }}
              size="sm"
              buttonClassName="h-8 px-3 bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl"
              menuClassName="w-52"
              renderMath={false}
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedAssignmentIds([])}
              className="text-xs text-white/70 hover:text-white h-8 px-2.5 rounded-lg cursor-pointer"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
