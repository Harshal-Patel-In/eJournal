/**
 * Classroom Space View.
 *
 * Grounded in Apple HIG, Impeccable UI standards, and Emil Kowalski motion design.
 */

"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
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
import { useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const urlTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"assignments" | "announcements" | "submissions" | "roster">(() => {
    if (urlTab === "announcements" || urlTab === "submissions" || urlTab === "roster" || urlTab === "assignments") {
      return urlTab;
    }
    return "assignments";
  });

  // Automatically switch tab when URL parameter updates (e.g., clicking announcement or gradebook notifications)
  useEffect(() => {
    if (urlTab === "announcements" || urlTab === "submissions" || urlTab === "roster" || urlTab === "assignments") {
      setActiveTab(urlTab);
    }
  }, [urlTab]);
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
  const [collapsedClusters, setCollapsedClusters] = useState<string[]>([]);
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());
  const [hoveredCalendarKey, setHoveredCalendarKey] = useState<string | null>(null);
  const [pinnedCalendarKey, setPinnedCalendarKey] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const toggleClusterCollapse = (cName: string) => {
    setCollapsedClusters((prev) =>
      prev.includes(cName) ? prev.filter((name) => name !== cName) : [...prev, cName]
    );
  };

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

  // 3.5 Fetch classroom submissions for teacher (powers live intelligence across views)
  const { data: submissions, isLoading: submissionsLoading } = useQuery<any[]>({
    queryKey: ["submissions", classroomId],
    queryFn: () => api.get(`/journals/classroom/${classroomId}/submissions`),
    enabled: !!user && user.role === "teacher",
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

  // 4. Fetch classroom members (always available for accurate enrollment metrics)
  const { data: members, isLoading: membersLoading } = useQuery<any[]>({
    queryKey: ["members", classroomId],
    queryFn: () => api.get(`/classrooms/${classroomId}/members`),
    enabled: !!classroomId,
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

  // Real-time Academic Intelligence Metrics
  const totalStudents = members?.length || 0;
  const totalPracticals = assignments?.length || 0;

  const pendingReviewsCount = useMemo(() => {
    if (!isTeacher || !submissions) return 0;
    return submissions.filter(
      (s: any) => s.status === "submitted" || s.status === "late_submitted"
    ).length;
  }, [isTeacher, submissions]);

  const pendingAssignments = useMemo(() => {
    if (!isTeacher || !assignments || !submissions) return [];
    return assignments
      .map((asg: any) => {
        const asgSubs = submissions.filter((s: any) => s.assignmentId === asg.id);
        const submittedJournals = asgSubs.filter(
          (s: any) =>
            s.status === "submitted" ||
            s.status === "late_submitted" ||
            s.status === "approved" ||
            s.status === "changes_requested"
        );
        const pending = asgSubs.filter(
          (s: any) => s.status === "submitted" || s.status === "late_submitted"
        ).length;
        const total = submittedJournals.length;
        const draft = asgSubs.filter(
          (s: any) => s.status === "draft" || s.status === "in_progress"
        ).length;
        return {
          id: asg.id,
          title: asg.title,
          expNum: asg.experimentNumber,
          pendingCount: pending,
          totalSubmitted: total,
          draftCount: draft,
          deadline: asg.deadline,
        };
      })
      .filter((item: any) => item.pendingCount > 0);
  }, [isTeacher, assignments, submissions]);

  // Calendar Intelligence Helpers (Google / Samsung / Apple Calendar Parity)
  const assignmentsByDateKey = useMemo(() => {
    const map = new Map<string, any[]>();
    if (!assignments) return map;

    assignments.forEach((asg: any) => {
      if (!asg.deadline) return;
      const d = new Date(asg.deadline);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${day}`;
      const list = map.get(key) || [];
      list.push(asg);
      map.set(key, list);
    });
    return map;
  }, [assignments]);

  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const calendarMonthName = calendarDate.toLocaleString("default", { month: "short", year: "numeric" });
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();

  const handlePrevMonth = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setCalendarDate(new Date(calendarYear, calendarMonth - 1, 1));
    setHoveredCalendarKey(null);
    setPinnedCalendarKey(null);
  };

  const handleNextMonth = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setCalendarDate(new Date(calendarYear, calendarMonth + 1, 1));
    setHoveredCalendarKey(null);
    setPinnedCalendarKey(null);
  };

  const handleJumpToToday = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setCalendarDate(new Date());
    setHoveredCalendarKey(null);
    setPinnedCalendarKey(null);
  };

  const handleDateMouseEnter = (key: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredCalendarKey(key);
  };

  const handleDateMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCalendarKey(null);
    }, 250);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const getCalendarDayStatus = (asgs: any[]) => {
    const now = new Date();
    let hasOverdueOrToday = false;
    let hasDueSoon = false;
    let allGraded = true;

    asgs.forEach((asg) => {
      const d = new Date(asg.deadline);
      const diffMs = d.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffMs < 0 || diffHours <= 24) {
        hasOverdueOrToday = true;
      } else if (diffDays <= 3) {
        hasDueSoon = true;
      }

      if (isTeacher) {
        const asgSubs = submissions?.filter((s: any) => s.assignmentId === asg.id) || [];
        const pending = asgSubs.filter((s: any) => s.status === "submitted" || s.status === "late_submitted").length;
        if (pending > 0 || asgSubs.length === 0) {
          allGraded = false;
        }
      }
    });

    if (hasOverdueOrToday) {
      return {
        type: "closed",
        label: "Due / Closed",
        dotClass: "bg-rose-500",
        barClass: "bg-rose-500 shadow-xs shadow-rose-500/50",
        cellClass: "bg-rose-500/[0.08] dark:bg-rose-500/[0.14] text-rose-700 dark:text-rose-300 border border-rose-500/25 font-bold shadow-2xs",
        shallowGradient: "bg-gradient-to-b from-rose-500/[0.08] via-popover/95 to-popover/95 dark:from-rose-500/[0.12] dark:via-zinc-900/95 dark:to-zinc-900/95",
        textClass: "text-rose-600 dark:text-rose-400",
      };
    }
    if (hasDueSoon) {
      return {
        type: "soon",
        label: "Due Soon",
        dotClass: "bg-amber-500",
        barClass: "bg-amber-500 shadow-xs shadow-amber-500/50",
        cellClass: "bg-amber-500/[0.08] dark:bg-amber-500/[0.14] text-amber-700 dark:text-amber-300 border border-amber-500/25 font-bold shadow-2xs",
        shallowGradient: "bg-gradient-to-b from-amber-500/[0.08] via-popover/95 to-popover/95 dark:from-amber-500/[0.12] dark:via-zinc-900/95 dark:to-zinc-900/95",
        textClass: "text-amber-600 dark:text-amber-400",
      };
    }
    if (isTeacher && allGraded && asgs.length > 0) {
      return {
        type: "graded",
        label: "Graded",
        dotClass: "bg-emerald-500",
        barClass: "bg-emerald-500 shadow-xs shadow-emerald-500/50",
        cellClass: "bg-emerald-500/[0.08] dark:bg-emerald-500/[0.14] text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 font-bold shadow-2xs",
        shallowGradient: "bg-gradient-to-b from-emerald-500/[0.08] via-popover/95 to-popover/95 dark:from-emerald-500/[0.12] dark:via-zinc-900/95 dark:to-zinc-900/95",
        textClass: "text-emerald-600 dark:text-emerald-400",
      };
    }
    return {
      type: "upcoming",
      label: "Upcoming",
      dotClass: "bg-sky-500",
      barClass: "bg-sky-500 shadow-xs shadow-sky-500/50",
      cellClass: "bg-sky-500/[0.08] dark:bg-sky-500/[0.14] text-sky-700 dark:text-sky-300 border border-sky-500/25 font-bold shadow-2xs",
      shallowGradient: "bg-gradient-to-b from-sky-500/[0.08] via-popover/95 to-popover/95 dark:from-sky-500/[0.12] dark:via-zinc-900/95 dark:to-zinc-900/95",
      textClass: "text-sky-600 dark:text-sky-400",
    };
  };

  const studentCompletedCount = useMemo(() => {
    if (isTeacher || !journals || !assignments) return 0;
    const assignmentIds = new Set(assignments.map((a: any) => a.id));
    return journals.filter(
      (j: any) => assignmentIds.has(j.assignmentId) && j.status === "approved"
    ).length;
  }, [isTeacher, journals, assignments]);

  const getDeadlineInfo = (deadlineStr: string) => {
    if (!deadlineStr) return null;
    const deadlineDate = new Date(deadlineStr);
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) {
      return {
        text: `Closed ${formatDateIST(deadlineStr)}`,
        badgeClass: "text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200/60 dark:border-white/10",
        isClosed: true,
      };
    }
    if (diffHours <= 24) {
      return {
        text: `Due Today (${formatDateIST(deadlineStr)})`,
        badgeClass: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30 font-bold",
        isUrgent: true,
      };
    }
    if (diffDays <= 3) {
      return {
        text: `Due in ${diffDays} days (${formatDateIST(deadlineStr)})`,
        badgeClass: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30 font-semibold",
        isWarning: true,
      };
    }
    return {
      text: `Deadline: ${formatDateIST(deadlineStr)}`,
      badgeClass: "text-muted-foreground bg-muted/40 border-border/40 font-medium",
    };
  };

  const renderAssignmentCard = (asg: any, isInClusterView = false) => {
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

    // Real-time Submission Intelligence for Teachers (Truthful & Accurate)
    const asgSubmissions = submissions?.filter((s: any) => s.assignmentId === asg.id) || [];
    const submittedJournals = asgSubmissions.filter(
      (s: any) =>
        s.status === "submitted" ||
        s.status === "late_submitted" ||
        s.status === "approved" ||
        s.status === "changes_requested"
    );
    const pendingCount = asgSubmissions.filter(
      (s: any) => s.status === "submitted" || s.status === "late_submitted"
    ).length;
    const totalSubmitted = submittedJournals.length;
    const draftCount = asgSubmissions.filter(
      (s: any) => s.status === "draft" || s.status === "in_progress"
    ).length;
    const deadlineInfo = getDeadlineInfo(asg.deadline);

    return (
      <div
        key={asg.id}
        className={`group p-4 sm:p-5 rounded-2xl glass-card hover:scale-[1.003] transition-all duration-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
          isMenuOpen ? "relative z-30" : "relative z-0"
        } ${isSelected ? "ring-2 ring-primary/40 bg-primary/[0.03]" : ""}`}
      >
        <div className="flex items-start gap-3 max-w-xl flex-1">
          {/* Checkbox for teacher bulk actions with gentle resting state (Hover Reveal) */}
          {isTeacher && (
            <button
              type="button"
              onClick={() => {
                setSelectedAssignmentIds((prev) =>
                  prev.includes(asg.id) ? prev.filter((id) => id !== asg.id) : [...prev, asg.id]
                );
              }}
              className={`mt-1 text-muted-foreground hover:text-foreground transition-all cursor-pointer shrink-0 ${
                isSelected
                  ? "opacity-100"
                  : selectedAssignmentIds.length > 0
                  ? "opacity-60 hover:opacity-100"
                  : "opacity-0 group-hover:opacity-100"
              }`}
              title={isSelected ? "Deselect" : "Select for bulk cluster action"}
            >
              {isSelected ? (
                <CheckSquare className="size-4 text-primary" />
              ) : (
                <Square className="size-4 text-muted-foreground/60" />
              )}
            </button>
          )}

          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono uppercase bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                Exp #{asg.experimentNumber}
              </span>
              {/* Only show cluster pill if NOT already visually grouped inside the cluster accordion */}
              {!isInClusterView && isTeacher && asg.clusterName && (
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

            <div className="flex flex-wrap items-center gap-3 mt-0.5 text-[11px] font-medium text-muted-foreground">
              {hasMarks ? (
                <span className="flex items-center gap-1 text-foreground font-bold bg-muted/40 border border-border/50 px-2 py-0.5 rounded-md">
                  <Sparkles className="size-3 text-amber-500" /> Grade: {relatedJournal.marks} / {asg.maxMarks} ({Math.round((relatedJournal.marks / asg.maxMarks) * 100)}%)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-foreground font-semibold">
                  <Sparkles className="size-3 text-amber-500" /> Max Marks: {asg.maxMarks}
                </span>
              )}

              {deadlineInfo && (
                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] ${deadlineInfo.badgeClass}`}>
                  <Calendar className="size-3" />
                  <span>{deadlineInfo.text}</span>
                </span>
              )}

              {/* Submission Status Chip in Metadata Row (Truthful, Structured & Harmonized) */}
              {isTeacher && totalStudents > 0 && (
                pendingCount > 0 ? (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 shadow-2xs">
                    <Clock className="size-3 text-amber-500 shrink-0" />
                    <span>
                      {totalSubmitted}/{totalStudents} Submitted ({pendingCount} to review)
                      {draftCount > 0 && (
                        <span className="font-normal text-muted-foreground ml-1">
                          • {draftCount} in draft
                        </span>
                      )}
                    </span>
                  </span>
                ) : totalSubmitted > 0 ? (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 shadow-2xs">
                    <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                    <span>
                      {totalSubmitted}/{totalStudents} Graded
                      {draftCount > 0 && (
                        <span className="font-normal text-muted-foreground ml-1">
                          • {draftCount} in draft
                        </span>
                      )}
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] text-muted-foreground/75 bg-muted/30 border-border/40">
                    <span>
                      0/{totalStudents} Submitted
                      {draftCount > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium ml-1">
                          ({draftCount} in draft)
                        </span>
                      )}
                    </span>
                  </span>
                )
              )}
            </div>
          </div>
        </div>

        {/* Card Actions - Unified Consistent Apple Button */}
        <div className="flex items-center gap-2 md:self-center shrink-0">
          {isTeacher ? (
            <div className="flex items-center gap-2 relative">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="font-semibold rounded-xl h-8 px-3.5 text-xs bg-white/80 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-foreground border-border/80 active:scale-95 transition-all cursor-pointer shadow-2xs"
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
                  className="size-8 p-0 rounded-xl cursor-pointer hover:bg-muted"
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
    <div className="min-h-screen bg-textured-workspace text-foreground flex flex-col">
      {/* Unified Floating Island Header Bar (Symmetrical & Integrated) */}
      <header className="fixed top-4 left-4 sm:left-8 md:left-12 right-4 sm:right-8 md:right-12 z-40 flex items-center justify-between px-3.5 sm:px-5 py-2.5 bg-gradient-to-b from-white/80 via-white/65 to-white/50 dark:from-zinc-900/85 dark:via-zinc-900/75 dark:to-zinc-950/70 backdrop-blur-2xl backdrop-saturate-180 border border-white/80 dark:border-white/15 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.1),_inset_0_1px_1px_0_rgba(255,255,255,0.95),_inset_0_-1px_1px_0_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7),_inset_0_1px_1px_0_rgba(255,255,255,0.18),_inset_0_-1px_1px_0_rgba(0,0,0,0.5)] rounded-2xl select-none transition-all duration-300">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Link
            href="/dashboard"
            title="Back to Dashboard"
            className="flex items-center gap-2 group select-none px-2 py-1.5 -ml-1 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all text-xs font-semibold shrink-0"
          >
            <ArrowLeft className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <img
              src="/logo.png"
              alt="eJournal Icon"
              className="h-6.5 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <span className="font-bold text-sm tracking-tight text-foreground">
              eJournal
            </span>
          </Link>
          <span className="text-muted-foreground/30 font-light select-none">/</span>
          <span className="font-bold text-sm tracking-tight text-foreground truncate max-w-[180px] sm:max-w-[280px] md:max-w-none">
            {classroom.name}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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

      {/* Subject Space Container with Left-Rail Desktop Two-Column Grid */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 pt-24 md:pt-24 relative z-10">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Desktop Intelligence Sidebar (Left Rail on Desktop: 320px/352px width, sticky on desktop, order-2 on mobile) */}
          <aside className="w-full lg:w-80 xl:w-88 shrink-0 flex flex-col gap-5 order-2 lg:order-1 lg:sticky lg:top-24">
            {/* Sidebar Card 1: Classroom Cohort & Student Join Code (Consolidated) */}
            <div className="p-5 rounded-2xl glass-card flex flex-col gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="size-3.5 text-indigo-500" />
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-foreground">
                    Classroom Cohort
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("roster")}
                  className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                >
                  View All ({totalStudents})
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">{totalStudents}</strong> enrolled students in <strong className="text-foreground">Semester {classroom.semester}</strong> ({classroom.department} - Div {classroom.division}).
              </p>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-background/80 border border-border/60 shadow-2xs">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Student Join Code</span>
                  <code className="font-mono text-xs font-black text-foreground">{classroom.joinCode}</code>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                >
                  {copiedCode ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                  <span>{copiedCode ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            {/* Sidebar Card 2: Live Action / Grading Queue for Teachers / Progress for Students */}
            {isTeacher ? (
              pendingReviewsCount > 0 ? (
                <div className="p-5 rounded-2xl glass-card flex flex-col gap-3.5 border border-amber-500/25 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      <h4 className="font-extrabold text-xs uppercase tracking-wider text-foreground">
                        Needs Grading ({pendingReviewsCount})
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Action Required</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {pendingAssignments.map((item: any) => (
                      <Link
                        key={item.id}
                        href={`/classrooms/${classroomId}/grades?assignment=${item.id}`}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-background/70 hover:bg-background border border-border/50 hover:border-amber-500/30 transition-all group shadow-2xs"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                            Exp #{item.expNum}: {item.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {item.totalSubmitted}/{totalStudents} submitted
                            {item.draftCount > 0 && ` (${item.draftCount} in draft)`}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
                          {item.pendingCount} to review
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-2xl glass-card flex flex-col items-center justify-center text-center gap-2 border border-emerald-500/20 shadow-xs">
                  <div className="size-9 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <h4 className="font-bold text-xs text-foreground">All Caught Up!</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[240px]">
                    All student journals for this classroom have been reviewed and graded.
                  </p>
                </div>
              )
            ) : (
              <div className="p-5 rounded-2xl glass-card flex flex-col gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-3.5 text-emerald-500" />
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-foreground">
                    Your Practical Progress
                  </h4>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-bold text-foreground">
                    {studentCompletedCount} of {totalPracticals}
                  </span>
                </div>
                <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${totalPracticals > 0 ? (studentCompletedCount / totalPracticals) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Sidebar Card 3: Interactive Academic Calendar with Popovers (Google/Samsung Style) */}
            <div className="p-5 rounded-2xl glass-card flex flex-col gap-3.5 shadow-xs relative">
              {/* Calendar Month & Navigation Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="size-3.5 text-sky-500" />
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-foreground">
                    Academic Calendar
                  </h4>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
                    title="Previous Month"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleJumpToToday}
                    className="text-xs font-bold font-mono px-1.5 py-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-foreground transition-all cursor-pointer"
                    title="Jump to Today"
                  >
                    {calendarMonthName}
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
                    title="Next Month"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted-foreground/75 select-none">
                <span>Su</span>
                <span>Mo</span>
                <span>Tu</span>
                <span>We</span>
                <span>Th</span>
                <span>Fr</span>
                <span>Sa</span>
              </div>

              {/* Day Cells Matrix */}
              <div className="grid grid-cols-7 gap-1 select-none">
                {/* Empty cells before month start */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-8 rounded-lg" />
                ))}

                {/* Days of current month */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const colIndex = (firstDayOfWeek + i) % 7;
                  const rowIndex = Math.floor((firstDayOfWeek + i) / 7);
                  const mStr = String(calendarMonth + 1).padStart(2, "0");
                  const dStr = String(day).padStart(2, "0");
                  const dateKey = `${calendarYear}-${mStr}-${dStr}`;
                  const dayAssignments = assignmentsByDateKey.get(dateKey) || [];
                  const hasEvents = dayAssignments.length > 0;
                  const dayStatus = hasEvents ? getCalendarDayStatus(dayAssignments) : null;

                  const today = new Date();
                  const isToday =
                    today.getFullYear() === calendarYear &&
                    today.getMonth() === calendarMonth &&
                    today.getDate() === day;

                  const isPopoverOpen =
                    hasEvents &&
                    (hoveredCalendarKey === dateKey || pinnedCalendarKey === dateKey);

                  return (
                    <div
                      key={dateKey}
                      className="relative"
                      onMouseEnter={() => hasEvents && handleDateMouseEnter(dateKey)}
                      onMouseLeave={handleDateMouseLeave}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (hasEvents) {
                            setPinnedCalendarKey((prev) => (prev === dateKey ? null : dateKey));
                          }
                        }}
                        className={`w-full h-8.5 rounded-xl flex flex-col items-center justify-center text-xs transition-all relative cursor-pointer ${
                          hasEvents && dayStatus
                            ? dayStatus.cellClass
                            : isToday
                            ? "font-extrabold text-primary border border-primary/40 bg-primary/10 shadow-2xs"
                            : "hover:bg-black/5 dark:hover:bg-white/5 text-foreground"
                        } ${
                          isToday && hasEvents
                            ? "ring-2 ring-primary ring-offset-1 dark:ring-offset-zinc-900"
                            : ""
                        } ${
                          pinnedCalendarKey === dateKey
                            ? "ring-2 ring-foreground/40 shadow-xs"
                            : hoveredCalendarKey === dateKey
                            ? "brightness-95 dark:brightness-110"
                            : ""
                        }`}
                      >
                        <span className={`leading-none text-[11px] ${isToday || hasEvents ? "font-bold" : "font-medium"}`}>{day}</span>

                        {/* Proper Event Mark: Horizontal Pill Indicator Bar */}
                        {hasEvents && dayStatus && (
                          <span
                            className={`w-3.5 h-[2.5px] rounded-full ${dayStatus.barClass} mt-1`}
                          />
                        )}
                      </button>

                      {/* Minimal & Elegant Calendar Tooltip with Persistent Hover Bridge & Shallow Gradient */}
                      {isPopoverOpen && dayStatus && (
                        <div
                          onMouseEnter={() => {
                            if (hoverTimeoutRef.current) {
                              clearTimeout(hoverTimeoutRef.current);
                              hoverTimeoutRef.current = null;
                            }
                          }}
                          onMouseLeave={handleDateMouseLeave}
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute z-50 w-68 p-3 rounded-2xl ${dayStatus.shallowGradient} backdrop-blur-2xl border border-border/70 dark:border-white/10 shadow-xl flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/5 dark:ring-white/5 pointer-events-auto ${
                            rowIndex === 0
                              ? "top-full mt-2 origin-top before:absolute before:-top-3 before:left-0 before:right-0 before:h-3 before:content-['']"
                              : "bottom-full mb-2 origin-bottom before:absolute before:-bottom-3 before:left-0 before:right-0 before:h-3 before:content-['']"
                          } ${colIndex >= 4 ? "right-0" : "left-0"}`}
                        >
                          {/* Popover Header */}
                          <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
                              <Calendar className="size-3 text-sky-500" />
                              <span>{formatDateIST(dateKey)}</span>
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                              {dayAssignments.length} {dayAssignments.length === 1 ? "Practical" : "Practicals"}
                            </span>
                          </div>

                          {/* Practical Experiments List */}
                          <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-0.5">
                            {dayAssignments.map((asg: any) => {
                              const dInfo = getDeadlineInfo(asg.deadline);
                              const asgSubs = submissions?.filter((s: any) => s.assignmentId === asg.id) || [];
                              const pending = asgSubs.filter((s: any) => s.status === "submitted" || s.status === "late_submitted").length;
                              const totalSub = asgSubs.filter((s: any) => s.status !== "draft").length;
                              const draft = asgSubs.filter((s: any) => s.status === "draft").length;

                              return (
                                <div
                                  key={asg.id}
                                  className="flex flex-col gap-1.5 p-2 rounded-xl bg-background/60 dark:bg-zinc-800/40 border border-border/40"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs font-bold text-foreground leading-tight truncate">
                                      Exp #{asg.experimentNumber}: {asg.title}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {dInfo && (
                                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${dInfo.badgeClass}`}>
                                        {dInfo.text}
                                      </span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      Max {asg.maxMarks}m
                                    </span>
                                  </div>

                                  {isTeacher ? (
                                    <div className="flex items-center justify-between pt-1 border-t border-border/40 mt-0.5">
                                      <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[140px]">
                                        {totalSub}/{totalStudents} submitted {pending > 0 ? `(${pending} to review)` : ""}{draft > 0 ? ` • ${draft} draft` : ""}
                                      </span>
                                      <Link
                                        href={`/classrooms/${classroomId}/grades?assignment=${asg.id}`}
                                        className="text-[11px] font-bold text-primary hover:underline shrink-0"
                                      >
                                        Grade →
                                      </Link>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between pt-1 border-t border-border/40 mt-0.5">
                                      <span className="text-[10px] text-muted-foreground">Due 11:59 PM</span>
                                      <Link
                                        href={`/editor/${asg.id}`}
                                        className="text-[11px] font-bold text-primary hover:underline shrink-0"
                                      >
                                        Open →
                                      </Link>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Status Color Legend */}
              <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[10px] font-medium text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-rose-500" />
                  <span>Due/Closed</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-amber-500" />
                  <span>Soon</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-sky-500" />
                  <span>Upcoming</span>
                </div>
                {isTeacher && (
                  <div className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span>Graded</span>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Master Working Canvas (Right Canvas on Desktop: 68% width, order-1 on mobile) */}
          <div className="flex-1 min-w-0 w-full flex flex-col gap-6 order-1 lg:order-2">
            {/* Banner Section with Spatial Anchor Notch, Academic Metrics & Primary Actions */}
            <div className="p-6 md:p-7 rounded-3xl glass-card relative overflow-hidden transition-all duration-300 flex flex-col gap-4 shadow-sm">
              {/* Option C Spatial Anchor Notch */}
              <div className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full bg-indigo-500/80 shadow-[0_0_12px_rgba(99,102,241,0.5)]" />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-1.5 pl-2 sm:pl-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 flex items-center gap-1 shadow-2xs">
                      <BookOpen className="size-3" />
                      {classroom.subject}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      Semester {classroom.semester} • Div {classroom.division}
                    </span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                    {classroom.name}
                  </h1>
                  <p className="text-xs font-medium text-muted-foreground">
                    {classroom.department}
                  </p>

                  {/* Real-time Academic Metrics Strip */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 mt-1">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 text-[11px] font-semibold text-foreground/80 shadow-2xs">
                      <Users className="size-3.5 text-indigo-500" />
                      <span>{totalStudents} {totalStudents === 1 ? "Student" : "Students"}</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 text-[11px] font-semibold text-foreground/80 shadow-2xs">
                      <FileText className="size-3.5 text-sky-500" />
                      <span>{totalPracticals} {totalPracticals === 1 ? "Practical" : "Practicals"}</span>
                    </div>

                    {isTeacher ? (
                      pendingReviewsCount > 0 ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 text-[11px] font-bold shadow-2xs">
                          <Clock className="size-3.5 text-amber-500" />
                          <span>{pendingReviewsCount} Pending Review</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 text-[11px] font-semibold shadow-2xs">
                          <CheckCircle2 className="size-3.5 text-emerald-500" />
                          <span>All Caught Up</span>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 text-[11px] font-semibold shadow-2xs">
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                        <span>{studentCompletedCount}/{totalPracticals} Completed</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary Classroom Actions (Prominent & Uncrowded) */}
                <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-center">
                  {isTeacher ? (
                    <>
                      <Button
                        onClick={() => setShowClusterModal(true)}
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs font-semibold rounded-xl h-9 px-3.5 active:scale-95 transition-all cursor-pointer whitespace-nowrap bg-background/80 hover:bg-background border-border/80 shadow-2xs"
                        title="Manage experiment clusters and cycles"
                      >
                        <Layers className="size-3.5 text-indigo-500" />
                        <span>Manage Clusters</span>
                      </Button>

                      <Button
                        onClick={() => setShowPublishModal(true)}
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs font-semibold rounded-xl h-9 px-4 active:scale-95 transition-all duration-150 cursor-pointer whitespace-nowrap bg-indigo-50/70 hover:bg-indigo-100/70 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 border-indigo-200/80 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                      >
                        <Plus className="size-3.5 text-indigo-500" />
                        <span>Publish Experiment</span>
                      </Button>
                    </>
                  ) : (
                    <Link href={`/classrooms/${classroomId}/compile-journal`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-xs font-semibold rounded-xl h-9 px-4 active:scale-95 transition-all cursor-pointer whitespace-nowrap bg-indigo-50/70 hover:bg-indigo-100/70 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 border-indigo-200/80 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                        title="Compile all practical experiments into an official master lab manual"
                      >
                        <BookOpen className="size-3.5 text-indigo-500" />
                        <span>Download Complete Journal</span>
                      </Button>
                    </Link>
                  )}
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
                {pendingReviewsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                    {pendingReviewsCount}
                  </span>
                )}
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
              <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold ${
                activeTab === "roster" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {totalStudents}
              </span>
            </button>
          </div>

          {/* Contextual Action Group (Only for Sub-views) */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">

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
                  {/* 1. Render Grouped Clusters with Collapsible Accordions (De-cluttered) */}
                  {existingClusterNames.map((cName) => {
                    const cAssignments = clusterGroups.clusters[cName];
                    const isCollapsed = collapsedClusters.includes(cName);
                    return (
                      <div key={cName} className="flex flex-col gap-3">
                        {/* Cluster Accordion Header Strip */}
                        <div
                          onClick={() => toggleClusterCollapse(cName)}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-indigo-500/[0.04] dark:bg-indigo-500/[0.08] border border-indigo-500/15 cursor-pointer hover:bg-indigo-500/[0.07] dark:hover:bg-indigo-500/[0.12] transition-all select-none shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="size-7.5 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center font-bold">
                              <Folder className="size-3.5" />
                            </div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-extrabold text-sm tracking-tight text-foreground">{cName}</h3>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                                {cAssignments.length} {cAssignments.length === 1 ? "Practical" : "Practicals"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => disbandClusterMutation.mutate(cName)}
                              disabled={disbandClusterMutation.isPending}
                              className="text-xs text-muted-foreground hover:text-destructive h-7 px-2.5 rounded-lg cursor-pointer"
                              title="Disband cluster (experiments become unclustered)"
                            >
                              <FolderX className="size-3 mr-1" />
                              <span>Disband</span>
                            </Button>

                            <button
                              type="button"
                              onClick={() => toggleClusterCollapse(cName)}
                              className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer transition-transform"
                              title={isCollapsed ? "Expand cluster" : "Collapse cluster"}
                            >
                              <ChevronDown className={`size-4 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`} />
                            </button>
                          </div>
                        </div>

                        {/* Clustered Practicals with Clean Structural Left Guide */}
                        {!isCollapsed && (
                          <div className="flex flex-col gap-3 pl-2 sm:pl-3 border-l-2 border-indigo-500/20 ml-3 animate-in fade-in-50 duration-200">
                            {cAssignments.map((asg) => renderAssignmentCard(asg, true))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* 2. Render Independent / General Curriculum Practicals */}
                  {clusterGroups.unclustered.length > 0 && (
                    <div className="flex flex-col gap-3 mt-1">
                      {existingClusterNames.length > 0 && (
                        <div className="flex items-center gap-2 px-1 pt-2">
                          <FileText className="size-3.5 text-muted-foreground" />
                          <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                            Independent Practicals ({clusterGroups.unclustered.length})
                          </h4>
                          <div className="flex-1 h-px bg-border/60 ml-2" />
                        </div>
                      )}
                      <div className="flex flex-col gap-3">
                        {clusterGroups.unclustered.map((asg) => renderAssignmentCard(asg, false))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Flat Sequential List for Students (Zero Cluster Clutter) */
                <div className="flex flex-col gap-3">
                  {[...assignments]
                    .sort((a, b) => a.experimentNumber - b.experimentNumber)
                    .map((asg) => renderAssignmentCard(asg, false))}
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
                    variant="outline"
                    size="sm"
                    className="mt-4 rounded-xl font-semibold active:scale-95 transition-all duration-150 bg-indigo-50/70 hover:bg-indigo-100/70 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 border-indigo-200/80 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                  >
                    <Plus className="size-3.5 text-indigo-500 mr-1.5" />
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
          </div>
        </div>
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
