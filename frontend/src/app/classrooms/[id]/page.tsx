/**
 * Classroom Space View.
 *
 * Grounded in Apple HIG, Impeccable UI standards, and Emil Kowalski motion design.
 */

"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
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
  Eye,
  FileEdit,
  FileText,
  Folder,
  FolderPlus,
  FolderX,
  GraduationCap,
  Layers,
  LayoutGrid,
  Loader2,
  MessageSquare,
  MessageSquareQuote,
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
import { cn } from "@/lib/utils";
import { getClassroomTheme, getClassroomCanvasStyle } from "@/lib/classroom-theme";
import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { PublishExperimentModal } from "@/components/classroom/publish-experiment-modal";

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
  const [editingAssignment, setEditingAssignment] = useState<any | null>(null);
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

  // Check if an assignment has graded submissions (for evaluation-lock protection)
  const isAssignmentGraded = (asgId: string) => {
    return (
      submissions?.some(
        (s: any) => s.assignmentId === asgId && s.status === "approved"
      ) || false
    );
  };

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

  const handleCopyCode = () => {
    if (classroom?.joinCode) {
      navigator.clipboard.writeText(classroom.joinCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const isTeacher = user?.role === "teacher";

  // Real-time Academic Intelligence Metrics & Cohort Visual Identity
  const theme = useMemo(
    () => getClassroomTheme(classroomId || classroom?.id),
    [classroomId, classroom?.id]
  );
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

    const toDateKey = (dateStr: string) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    assignments.forEach((asg: any) => {
      // 1. Lab Conducted Session Date (🔵 Upcoming Lab Session)
      if (asg.conductedDate) {
        const k = toDateKey(asg.conductedDate);
        if (k) {
          const list = map.get(k) || [];
          list.push({
            id: `${asg.id}-lab`,
            assignment: asg,
            eventType: "lab_session",
            dateStr: asg.conductedDate,
            title: `Lab Session: Exp #${asg.experimentNumber}`,
          });
          map.set(k, list);
        }
      }

      // 2. Submission Deadline (Due / Soon / Closed / Graded)
      if (asg.deadline) {
        const k = toDateKey(asg.deadline);
        if (k) {
          const list = map.get(k) || [];
          list.push({
            id: `${asg.id}-deadline`,
            assignment: asg,
            eventType: "deadline",
            dateStr: asg.deadline,
            title: `Cut-off Deadline: Exp #${asg.experimentNumber}`,
          });
          map.set(k, list);
        }
      }

      // 3. For Teachers: Scheduled Future Release
      if (isTeacher && asg.publishDate && new Date(asg.publishDate) > new Date()) {
        const k = toDateKey(asg.publishDate);
        if (k) {
          const list = map.get(k) || [];
          list.push({
            id: `${asg.id}-publish`,
            assignment: asg,
            eventType: "scheduled_publish",
            dateStr: asg.publishDate,
            title: `Scheduled Release: Exp #${asg.experimentNumber}`,
          });
          map.set(k, list);
        }
      }
    });
    return map;
  }, [assignments, isTeacher]);

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

  const getCalendarDayStatus = (events: any[]) => {
    const now = new Date();
    let hasOverdueOrToday = false;
    let hasDueSoon = false;
    let allGraded = true;

    events.forEach((item) => {
      const asg = item.assignment;
      const isLab = item.eventType === "lab_session";

      if (isLab) {
        allGraded = false;
        return;
      }

      // Deadline check
      const d = new Date(item.dateStr || asg.deadline);
      const diffMs = d.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Graded check
      let isGraded = false;
      if (isTeacher) {
        const asgSubs = submissions?.filter((s: any) => s.assignmentId === asg.id) || [];
        const pending = asgSubs.filter((s: any) => s.status === "submitted" || s.status === "late_submitted").length;
        const approvedCount = asgSubs.filter((s: any) => s.status === "approved").length;
        if (approvedCount > 0 && pending === 0) {
          isGraded = true;
        } else {
          allGraded = false;
        }
      } else {
        const myJournal = journals?.find((j: any) => j.assignmentId === asg.id);
        if (myJournal?.status === "approved") {
          isGraded = true;
        } else {
          allGraded = false;
        }
      }

      if (!isGraded) {
        if (diffMs < 0 || diffHours <= 24) {
          hasOverdueOrToday = true;
        } else if (diffDays <= 3) {
          hasDueSoon = true;
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
    if (allGraded && events.length > 0) {
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

  const studentPendingCount = useMemo(() => {
    if (isTeacher || !journals || !assignments) return 0;
    const assignmentIds = new Set(assignments.map((a: any) => a.id));
    return journals.filter(
      (j: any) => assignmentIds.has(j.assignmentId) && (j.status === "submitted" || j.status === "late_submitted")
    ).length;
  }, [isTeacher, journals, assignments]);

  const upNextPractical = useMemo(() => {
    if (isTeacher || !assignments || assignments.length === 0) return null;
    const sorted = [...assignments].sort((a, b) => a.experimentNumber - b.experimentNumber);

    // Priority 1: changes requested (student needs to revise)
    const needsRevision = sorted.find((asg) => {
      const j = journals?.find((item: any) => item.assignmentId === asg.id);
      return j?.status === "changes_requested";
    });
    if (needsRevision) {
      const j = journals?.find((item: any) => item.assignmentId === needsRevision.id);
      return { asg: needsRevision, journal: j, status: "changes_requested" };
    }

    // Priority 2: in progress / draft
    const inProgress = sorted.find((asg) => {
      const j = journals?.find((item: any) => item.assignmentId === asg.id);
      return j?.status === "draft" || j?.status === "in_progress";
    });
    if (inProgress) {
      const j = journals?.find((item: any) => item.assignmentId === inProgress.id);
      return { asg: inProgress, journal: j, status: "in_progress" };
    }

    // Priority 3: not started
    const notStarted = sorted.find((asg) => {
      const j = journals?.find((item: any) => item.assignmentId === asg.id);
      return !j;
    });
    if (notStarted) {
      return { asg: notStarted, journal: null, status: "not_started" };
    }

    // All are submitted or approved
    return null;
  }, [isTeacher, assignments, journals]);

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
        className={`group p-4 sm:p-5 rounded-xl border border-border/80 bg-card hover:border-border hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
          isMenuOpen ? "relative z-30" : "relative z-0"
        } ${isSelected ? "ring-2 ring-primary/40 bg-muted/40" : ""}`}
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
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-foreground border border-border">
                Exp #{asg.experimentNumber}
              </span>
              {/* Only show cluster pill if NOT already visually grouped inside the cluster accordion */}
              {!isInClusterView && isTeacher && asg.clusterName && (
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border flex items-center gap-1">
                  <Folder className="size-2.5" />
                  {asg.clusterName}
                </span>
              )}
              <h4 className={cn("font-bold text-sm tracking-tight text-foreground transition-colors", theme.hoverTitle)}>
                {asg.title}
              </h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {asg.aim}
            </p>

            {/* Instructor Remarks Callout Card */}
            {relatedJournal?.teacherRemarks && (
              <div className="p-3 rounded-lg bg-amber-500/[0.08] dark:bg-amber-500/[0.12] border border-amber-500/25 flex items-start gap-2.5 text-xs text-foreground mt-1">
                <MessageSquareQuote className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                    Instructor remarks
                  </span>
                  <p className="italic text-foreground/90 font-medium leading-relaxed font-serif">
                    "{relatedJournal.teacherRemarks}"
                  </p>
                </div>
              </div>
            )}

            {/* Consolidated Annotation Feedback Strip */}
            {relatedJournal?.annotationCounts && Object.keys(relatedJournal.annotationCounts).length > 0 && (() => {
              const totalAnnotations = Object.values(relatedJournal.annotationCounts).reduce(
                (acc: number, c: any) => acc + (Number(c) || 0),
                0
              );
              const warningCount = Number(relatedJournal.annotationCounts["Warning"] || 0);
              const questionCount = Number(relatedJournal.annotationCounts["Question"] || 0);
              const commentCount = Number(relatedJournal.annotationCounts["Comment"] || 0);
              const suggestionCount = Number(relatedJournal.annotationCounts["Suggestion"] || 0);

              return (
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-muted/80 text-foreground border border-border">
                    <MessageSquare className="size-3 text-muted-foreground" />
                    <span>{totalAnnotations} notes</span>
                  </span>
                  {warningCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      <AlertTriangle className="size-3 text-amber-500" />
                      <span>{warningCount} action needed</span>
                    </span>
                  )}
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground flex-wrap">
                    {commentCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-muted/60 border border-border text-[10px]">
                        {commentCount} comments
                      </span>
                    )}
                    {suggestionCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-muted/60 border border-border text-[10px]">
                        {suggestionCount} suggestions
                      </span>
                    )}
                    {questionCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-muted/60 border border-border text-[10px]">
                        {questionCount} questions
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-wrap items-center gap-3 mt-0.5 text-[11px] font-medium text-muted-foreground">
              {hasMarks ? (
                <span className="flex items-center gap-1 text-foreground font-bold bg-muted/60 border border-border px-2 py-0.5 rounded tabular-nums">
                  <Sparkles className="size-3 text-primary" /> Marks: {relatedJournal.marks} / {asg.maxMarks} ({Math.round((relatedJournal.marks / asg.maxMarks) * 100)}%)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-foreground font-medium tabular-nums">
                  <Sparkles className="size-3 text-muted-foreground" /> Max marks: {asg.maxMarks}
                </span>
              )}

              {deadlineInfo && (
                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] ${deadlineInfo.badgeClass}`}>
                  <Calendar className="size-3" />
                  <span>{deadlineInfo.text}</span>
                </span>
              )}

              {asg.conductedDate && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30">
                  <Calendar className="size-3 text-sky-500" />
                  <span>Lab: {formatDateIST(asg.conductedDate)}</span>
                </span>
              )}

              {asg.rubric && asg.rubric.length > 0 && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] bg-primary/10 text-primary border-primary/20">
                  <span>{asg.rubric.length} Rubric Criteria</span>
                </span>
              )}

              {isTeacher && asg.publishDate && new Date(asg.publishDate) > new Date() && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 font-semibold">
                  <Clock className="size-3" />
                  <span>Scheduled: {formatDateIST(asg.publishDate)}</span>
                </span>
              )}

              {/* Submission Status Chip in Metadata Row (Truthful, Structured & Harmonized) */}
              {isTeacher && totalStudents > 0 && (
                pendingCount > 0 ? (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 tabular-nums">
                    <Clock className="size-3 text-amber-500 shrink-0" />
                    <span>
                      {totalSubmitted}/{totalStudents} submitted ({pendingCount} pending)
                      {draftCount > 0 && (
                        <span className="font-normal text-muted-foreground ml-1">
                          • {draftCount} in draft
                        </span>
                      )}
                    </span>
                  </span>
                ) : totalSubmitted > 0 ? (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium bg-muted text-foreground border-border tabular-nums">
                    <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      {totalSubmitted}/{totalStudents} graded
                      {draftCount > 0 && (
                        <span className="font-normal text-muted-foreground ml-1">
                          • {draftCount} in draft
                        </span>
                      )}
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] text-muted-foreground bg-muted/30 border-border tabular-nums">
                    <span>
                      0/{totalStudents} submitted
                      {draftCount > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 ml-1">
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

        {/* Card Actions - Purposeful Semantic Buttons */}
        <div className="flex items-center gap-2 md:self-center shrink-0">
          {isTeacher ? (
            <div className="flex items-center gap-2 relative">
              {pendingCount > 0 ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="font-semibold rounded-md h-8 px-3 text-xs glass-btn-amber shadow-xs active:scale-[0.98] transition-all cursor-pointer gap-1.5"
                >
                  <Link href={`/classrooms/${classroomId}/grades?assignment=${asg.id}`}>
                    <span>Grade submissions ({pendingCount})</span>
                  </Link>
                </Button>
              ) : totalSubmitted > 0 ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="font-semibold rounded-md h-8 px-3 text-xs glass-btn-emerald-outline shadow-xs active:scale-[0.98] transition-all cursor-pointer gap-1.5"
                >
                  <Link href={`/classrooms/${classroomId}/grades?assignment=${asg.id}`}>
                    <span>Submissions graded</span>
                  </Link>
                </Button>
              ) : (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="font-medium rounded-md h-8 px-3 text-xs glass-btn-frosted active:scale-[0.98] transition-all cursor-pointer shadow-xs"
                >
                  <Link href={`/classrooms/${classroomId}/grades?assignment=${asg.id}`}>
                    <span>Grade submissions</span>
                  </Link>
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingAssignment(asg);
                  setShowPublishModal(true);
                }}
                className="font-medium rounded-md h-8 px-2.5 text-xs glass-btn-frosted shadow-xs active:scale-[0.98] transition-all cursor-pointer gap-1"
                title="Edit practical details, timeline or rubrics"
              >
                <Edit2 className="size-3 text-muted-foreground" />
                <span>Edit</span>
              </Button>

              {/* In-place Cluster Move Menu */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpenCardMenuId(openCardMenuId === asg.id ? null : asg.id)}
                  className="size-8 p-0 rounded-md cursor-pointer hover:bg-muted border border-border"
                  title="Cluster Options"
                >
                  <MoreVertical className="size-3.5 text-muted-foreground" />
                </Button>

                {openCardMenuId === asg.id && (
                  <div className="absolute right-0 top-full mt-1.5 w-56 rounded-md bg-popover border border-border shadow-md p-1.5 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenCardMenuId(null);
                        setEditingAssignment(asg);
                        setShowPublishModal(true);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium hover:bg-accent transition-colors text-left cursor-pointer"
                    >
                      <Edit2 className="size-3.5 text-muted-foreground" />
                      <span>Edit practical & rubrics...</span>
                    </button>

                    <div className="my-1 border-t border-border" />

                    <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Assign to cluster
                    </span>

                    {/* Uncluster option */}
                    <button
                      type="button"
                      onClick={() => updateClusterMutation.mutate({ assignmentId: asg.id, clusterName: null })}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-medium hover:bg-accent transition-colors text-left cursor-pointer"
                    >
                      <span>None (Unclustered)</span>
                      {!asg.clusterName && <Check className="size-3 text-primary" />}
                    </button>

                    {/* Existing clusters */}
                    {existingClusterNames.map((cName) => (
                      <button
                        key={cName}
                        onClick={() => updateClusterMutation.mutate({ assignmentId: asg.id, clusterName: cName })}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-medium hover:bg-accent transition-colors text-left cursor-pointer"
                      >
                        <span className="truncate">{cName}</span>
                        {asg.clusterName === cName && <Check className="size-3 text-primary" />}
                      </button>
                    ))}

                    <div className="my-1 border-t border-border" />

                    <button
                      type="button"
                      onClick={() => {
                        setOpenCardMenuId(null);
                        setSelectedAssignmentIds([asg.id]);
                        setShowClusterModal(true);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-primary hover:bg-primary/10 transition-colors text-left cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      <span>Create new cluster...</span>
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
              className="font-semibold rounded-md h-8 px-3.5 text-xs glass-btn-indigo-solid active:scale-[0.98] transition-all cursor-pointer shadow-xs gap-1.5"
            >
              {startJournalMutation.isPending && startJournalMutation.variables === asg.id ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin" />
                  <span>Starting...</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span>Start journal</span>
                  <ArrowRight className="size-3.5" />
                </span>
              )}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-medium border text-center ${
                  isApproved
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold"
                    : isLateSubmitted
                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 font-semibold"
                    : isSubmitted
                    ? "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30 font-semibold"
                    : isChangesRequested
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold"
                    : "bg-muted text-foreground border-border"
                }`}
              >
                {isApproved
                  ? "Approved"
                  : isLateSubmitted
                  ? "Late submitted"
                  : isSubmitted
                  ? "Handed in"
                  : isChangesRequested
                  ? "Changes requested"
                  : "In progress"}
              </span>

              {isChangesRequested ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="font-semibold rounded-md h-8 px-3 text-xs glass-btn-amber shadow-xs active:scale-[0.98] transition-all cursor-pointer gap-1.5"
                >
                  <Link href={`/editor/${relatedJournal.id}`}>
                    <FileEdit className="size-3.5" />
                    <span>Revise journal</span>
                  </Link>
                </Button>
              ) : isApproved ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="font-semibold rounded-md h-8 px-3 text-xs glass-btn-emerald-outline shadow-xs active:scale-[0.98] transition-all cursor-pointer gap-1.5"
                >
                  <Link href={`/editor/${relatedJournal.id}`}>
                    <span>View evaluation</span>
                    <ArrowUpRight className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  </Link>
                </Button>
              ) : isLocked ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="font-medium rounded-md h-8 px-3 text-xs glass-btn-frosted shadow-xs active:scale-[0.98] transition-all cursor-pointer gap-1.5"
                >
                  <Link href={`/editor/${relatedJournal.id}`}>
                    <Eye className="size-3.5 text-muted-foreground" />
                    <span>Preview journal</span>
                  </Link>
                </Button>
              ) : (
                <Button
                  asChild
                  size="sm"
                  className="font-semibold rounded-md h-8 px-3.5 text-xs glass-btn-indigo-solid active:scale-[0.98] transition-all cursor-pointer shadow-xs gap-1.5"
                >
                  <Link href={`/editor/${relatedJournal.id}`}>
                    <span>Resume journal</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (classroomLoading || assignmentsLoading) {
    return (
      <AppLoadingScreen
        title="Loading Classroom Workspace..."
        subtitle="Syncing assignments, announcements, and classroom members..."
      />
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
    <div
      className="min-h-screen bg-textured-workspace text-foreground flex flex-col"
      style={getClassroomCanvasStyle(theme)}
    >
      {/* Grounded Institutional Archival Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 backdrop-blur-xs px-4 sm:px-8 py-3 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Link
            href="/dashboard"
            title="Back to dashboard"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-foreground glass-btn-elevated cursor-pointer shrink-0"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <span className="text-muted-foreground/30 font-light select-none">/</span>
          <span className="font-bold text-sm tracking-tight text-foreground truncate max-w-[180px] sm:max-w-[280px] md:max-w-none font-serif">
            {classroom.name}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <ThemeToggle />
          <NotificationBell />
          <Link href="/profile" title="View & Edit Academic Profile">
            <div className="size-8 rounded-md glass-btn-elevated flex items-center justify-center font-bold text-xs cursor-pointer text-foreground">
              <User className="size-3.5" />
            </div>
          </Link>
        </div>
      </header>

      {/* Subject Space Container with Left-Rail Desktop Two-Column Grid */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 relative z-10">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Desktop Intelligence Sidebar (Left Rail on Desktop: 320px/352px width, sticky on desktop, order-2 on mobile) */}
          <aside className="w-full lg:w-80 xl:w-88 shrink-0 flex flex-col gap-5 order-2 lg:order-1 lg:sticky lg:top-24">
            {/* Sidebar Card 1: Classroom Cohort for Teachers vs Actionable Up Next Lab for Students */}
            {isTeacher ? (
              <div className="p-5 rounded-xl border border-border/70 bg-card/85 backdrop-blur-md shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="size-3.5 text-muted-foreground" />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                      Classroom cohort
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("roster")}
                    className={cn("text-[10px] font-semibold hover:underline cursor-pointer", theme.accentText)}
                  >
                    View all ({totalStudents})
                  </button>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground font-semibold tabular-nums">{totalStudents}</strong> enrolled students in <strong className="text-foreground">Semester {classroom.semester}</strong> ({classroom.department} - Div {classroom.division}).
                </p>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Student join code</span>
                    <code className="font-mono text-xs font-bold text-foreground">{classroom.joinCode}</code>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-muted hover:bg-muted/80 text-foreground border border-border transition-all cursor-pointer flex items-center gap-1 active:scale-[0.98]"
                  >
                    {copiedCode ? <Check className="size-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="size-3" />}
                    <span>{copiedCode ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>
            ) : upNextPractical ? (
              <div className="p-5 rounded-xl border border-border/70 bg-card/85 backdrop-blur-md shadow-xs flex flex-col gap-3.5 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded bg-muted text-foreground flex items-center justify-center border border-border">
                      <BookOpen className={cn("size-3.5", theme.accentText)} />
                    </div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                      Up next
                    </h4>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                      upNextPractical.status === "changes_requested"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold"
                        : upNextPractical.status === "in_progress"
                        ? "bg-muted text-foreground border-border"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {upNextPractical.status === "changes_requested"
                      ? "Action Needed"
                      : upNextPractical.status === "in_progress"
                      ? "In Progress"
                      : "Not Started"}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary">
                    <span>Experiment #{upNextPractical.asg.experimentNumber}</span>
                  </div>
                  <h5 className="font-bold text-sm text-foreground tracking-tight line-clamp-1 mt-0.5">
                    {upNextPractical.asg.title}
                  </h5>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                    {upNextPractical.asg.aim}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
                    Max: {upNextPractical.asg.maxMarks} Marks
                  </span>

                  {upNextPractical.journal ? (
                    <Button
                      asChild
                      variant={upNextPractical.status === "changes_requested" ? "outline" : "default"}
                      size="sm"
                      className={cn(
                        "font-semibold rounded-md h-8 px-3 text-xs active:scale-[0.98] transition-all cursor-pointer shadow-xs gap-1",
                        upNextPractical.status === "changes_requested" ? "glass-btn-amber" : "glass-btn-indigo-solid"
                      )}
                    >
                      <Link href={`/editor/${upNextPractical.journal.id}`}>
                        <span>{upNextPractical.status === "changes_requested" ? "Revise journal" : "Resume draft"}</span>
                        <ArrowRight className="size-3" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => startJournalMutation.mutate(upNextPractical.asg.id)}
                      disabled={startJournalMutation.isPending}
                      className="font-semibold rounded-md h-8 px-3 text-xs glass-btn-indigo-solid active:scale-[0.98] transition-all cursor-pointer shadow-xs gap-1"
                    >
                      {startJournalMutation.isPending && startJournalMutation.variables === upNextPractical.asg.id ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="size-3 animate-spin" />
                          <span>Starting...</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <span>Start journal</span>
                          <ArrowRight className="size-3" />
                        </span>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] shadow-xs flex flex-col items-center justify-center text-center gap-2">
                <div className="size-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="size-4" />
                </div>
                <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Coursework current</h4>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[240px]">
                  All practical experiments in this classroom have been submitted or approved.
                </p>
              </div>
            )}

            {/* Sidebar Card 2: Live Action / Grading Queue for Teachers / Progress for Students */}
            {isTeacher ? (
              pendingReviewsCount > 0 ? (
                <div className="p-5 rounded-xl border border-border/70 bg-card/85 backdrop-blur-md shadow-xs flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                        Needs grading ({pendingReviewsCount})
                      </h4>
                    </div>
                    <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">Action required</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {pendingAssignments.map((item: any) => (
                      <Link
                        key={item.id}
                        href={`/classrooms/${classroomId}/grades?assignment=${item.id}`}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 hover:bg-muted border border-border transition-all group"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className={cn("text-xs font-bold text-foreground truncate transition-colors", theme.hoverTitle)}>
                            Exp #{item.expNum}: {item.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                            {item.totalSubmitted}/{totalStudents} submitted
                            {item.draftCount > 0 && ` (${item.draftCount} draft)`}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold tabular-nums bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
                          {item.pendingCount} pending
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-xl border border-border/70 bg-card/85 backdrop-blur-md shadow-xs flex flex-col items-center justify-center text-center gap-2">
                  <div className="size-8 rounded bg-muted text-emerald-600 dark:text-emerald-400 border border-border flex items-center justify-center">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">All reviews cleared</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[240px]">
                    All student journals for this classroom have been reviewed and graded.
                  </p>
                </div>
              )
            ) : (
              <div className="p-5 rounded-xl border border-border/70 bg-card/85 backdrop-blur-md shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className={cn("size-3.5", theme.accentText)} />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                      Practical progress
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-foreground border border-border tabular-nums">
                    {totalPracticals > 0 ? Math.round((studentCompletedCount / totalPracticals) * 100) : 0}% done
                  </span>
                </div>

                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground font-sans text-xs">Evaluation completed</span>
                  <span className="font-bold text-foreground tabular-nums">
                    {studentCompletedCount} / {totalPracticals}
                  </span>
                </div>

                <div className="h-2 w-full bg-muted/80 rounded-full overflow-hidden border border-border/50">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${totalPracticals > 0 ? (studentCompletedCount / totalPracticals) * 100 : 0}%`,
                    }}
                  />
                </div>

                {studentPendingCount > 0 && (
                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground font-sans text-xs">Awaiting evaluation</span>
                    <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 tabular-nums">
                      <Clock className="size-3 text-amber-500" />
                      {studentPendingCount} in review
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Sidebar Card 3: Interactive Academic Calendar with Popovers */}
            <div className="p-5 rounded-xl border border-border/70 bg-card/85 backdrop-blur-md shadow-xs flex flex-col gap-3.5 relative">
              {/* Calendar Month & Navigation Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                    Academic calendar
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
                    className="text-xs font-bold px-1.5 py-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-foreground transition-all cursor-pointer tabular-nums"
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
                        className={`w-full h-8.5 rounded-lg flex flex-col items-center justify-center text-xs transition-all relative cursor-pointer ${
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

                        {/* Proper Event Mark: Glowing Horizontal Pill Indicator Bar */}
                        {hasEvents && dayStatus && (
                          <span
                            className={`w-3.5 h-[2.5px] rounded-full ${dayStatus.barClass} mt-1`}
                          />
                        )}
                      </button>

                      {/* Minimal & Elegant Calendar Tooltip with Persistent Hover Bridge */}
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
                          className={`absolute z-50 w-[264px] sm:w-[270px] p-3.5 rounded-xl border border-border/80 shadow-xl flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto backdrop-blur-md ${dayStatus.shallowGradient} ${
                            rowIndex === 0
                              ? "top-full mt-2 origin-top before:absolute before:-top-3 before:left-0 before:right-0 before:h-3 before:content-['']"
                              : "bottom-full mb-2 origin-bottom before:absolute before:-bottom-3 before:left-0 before:right-0 before:h-3 before:content-['']"
                          } ${
                            colIndex === 0
                              ? "left-0"
                              : colIndex === 1
                              ? "-left-9"
                              : colIndex === 2
                              ? "-left-18"
                              : colIndex === 3
                              ? "left-1/2 -translate-x-1/2"
                              : colIndex === 4
                              ? "-right-18"
                              : colIndex === 5
                              ? "-right-9"
                              : "right-0"
                          }`}
                        >
                          {/* Popover Header */}
                          <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
                              <Calendar className="size-3 text-primary" />
                              <span>{formatDateIST(dateKey)}</span>
                            </div>
                            <span className="text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground border border-border">
                              {dayAssignments.length} {dayAssignments.length === 1 ? "practical" : "practicals"}
                            </span>
                          </div>

                          {/* Practical Experiments List */}
                          <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-0.5">
                            {dayAssignments.map((eventItem: any) => {
                              const asg = eventItem.assignment || eventItem;
                              const isLab = eventItem.eventType === "lab_session";
                              const isPublish = eventItem.eventType === "scheduled_publish";
                              const dInfo = !isLab && !isPublish ? getDeadlineInfo(asg.deadline) : null;
                              const asgSubs = submissions?.filter((s: any) => s.assignmentId === asg.id) || [];
                              const pending = asgSubs.filter((s: any) => s.status === "submitted" || s.status === "late_submitted").length;
                              const totalSub = asgSubs.filter((s: any) => s.status !== "draft").length;
                              const draft = asgSubs.filter((s: any) => s.status === "draft").length;
                              const relatedJournal = journals?.find((j: any) => j.assignmentId === asg.id);
                              const isApproved = relatedJournal?.status === "approved";

                              return (
                                <div
                                  key={eventItem.id || asg.id}
                                  className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-card/85 backdrop-blur-xs border border-border/60 shadow-2xs"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs font-bold text-foreground leading-tight truncate">
                                      Exp #{asg.experimentNumber}: {asg.title}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {isLab ? (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 flex items-center gap-1">
                                        <span className="size-1.5 rounded-full bg-sky-500" />
                                        <span>Lab Session</span>
                                      </span>
                                    ) : isPublish ? (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30">
                                        Scheduled Release
                                      </span>
                                    ) : isApproved ? (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border tabular-nums bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                                        Graded ({relatedJournal?.marks}/{asg.maxMarks}m)
                                      </span>
                                    ) : dInfo ? (
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${dInfo.badgeClass}`}>
                                        {dInfo.text}
                                      </span>
                                    ) : null}

                                    <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                                      Max {asg.maxMarks}m
                                    </span>
                                  </div>

                                  {isTeacher ? (
                                    <div className="flex items-center justify-between pt-1 border-t border-border mt-0.5">
                                      <span className="text-[10px] text-muted-foreground font-medium tabular-nums truncate max-w-[140px]">
                                        {totalSub}/{totalStudents} submitted {pending > 0 ? `(${pending} pending)` : ""}{draft > 0 ? ` • ${draft} draft` : ""}
                                      </span>
                                      <Link
                                        href={`/classrooms/${classroomId}/grades?assignment=${asg.id}`}
                                        className="text-[11px] font-semibold text-primary hover:underline shrink-0"
                                      >
                                        Grade →
                                      </Link>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between pt-1 border-t border-border mt-0.5">
                                      <span className="text-[10px] text-muted-foreground font-medium">
                                        {isLab ? "Conducted in Lab" : isApproved ? "Evaluation Complete" : "Due 11:59 PM"}
                                      </span>
                                      <Link
                                        href={relatedJournal ? `/editor/${relatedJournal.id}` : `/editor/new?assignmentId=${asg.id}`}
                                        className="text-[11px] font-semibold text-primary hover:underline shrink-0"
                                      >
                                        {isApproved ? "Review →" : relatedJournal ? "Continue →" : "Start →"}
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
              <div className="flex items-center justify-between pt-2 border-t border-border text-[10px] font-medium text-muted-foreground">
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
                <div className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>Graded</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Master Working Canvas (Right Canvas on Desktop: 68% width, order-1 on mobile) */}
          <div className="flex-1 min-w-0 w-full flex flex-col gap-6 order-1 lg:order-2">
            {/* Banner Section with Spatial Anchor Notch, Academic Metrics & Primary Actions */}
            <div className="p-6 md:p-7 rounded-xl border border-border/70 bg-card/85 backdrop-blur-md relative overflow-hidden transition-all duration-200 flex flex-col gap-4 shadow-sm">
              {/* Ambient Subject Atmospheric Glow */}
              <div
                className={cn(
                  "absolute -right-16 -top-16 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-40 transition-all duration-700",
                  theme.bannerGlow
                )}
              />

              {/* Spatial Anchor Notch */}
              <div
                className={cn(
                  "absolute left-0 top-6 bottom-6 w-1 rounded-r-full transition-all duration-200",
                  theme.indicator,
                  theme.notchGlow
                )}
              />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                <div className="flex flex-col gap-1.5 pl-2 sm:pl-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[11px] border tracking-wide font-medium flex items-center gap-1.5",
                        theme.badge
                      )}
                    >
                      <BookOpen className="size-3" />
                      {classroom.subject}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      Semester {classroom.semester} • Div {classroom.division}
                    </span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground font-serif">
                    {classroom.name}
                  </h1>
                  <p className="text-xs text-muted-foreground font-medium">
                    {classroom.department}
                  </p>

                  {/* Real-time Academic Metrics Strip */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border mt-1">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted/60 border border-border text-[11px] font-medium text-foreground tabular-nums">
                      <Users className="size-3.5 text-muted-foreground" />
                      <span>{totalStudents} {totalStudents === 1 ? "student" : "students"}</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted/60 border border-border text-[11px] font-medium text-foreground tabular-nums">
                      <FileText className="size-3.5 text-muted-foreground" />
                      <span>{totalPracticals} {totalPracticals === 1 ? "practical" : "practicals"}</span>
                    </div>

                    {isTeacher ? (
                      pendingReviewsCount > 0 ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] font-semibold tabular-nums">
                          <Clock className="size-3.5 text-amber-500" />
                          <span>{pendingReviewsCount} pending review</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted/60 text-foreground border border-border text-[11px] font-medium">
                          <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>All caught up</span>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-medium tabular-nums">
                        <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{studentCompletedCount}/{totalPracticals} completed</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary Classroom Actions */}
                <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
                  {isTeacher ? (
                    <>
                      <Button
                        onClick={() => setShowClusterModal(true)}
                        size="sm"
                        className="gap-1.5 text-xs font-semibold rounded-lg h-8 px-3 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap glass-btn-frosted shadow-xs"
                        title="Manage experiment clusters and cycles"
                      >
                        <Layers className="size-3.5 text-muted-foreground" />
                        <span>Manage clusters</span>
                      </Button>

                      <Button
                        onClick={() => {
                          setEditingAssignment(null);
                          setShowPublishModal(true);
                        }}
                        size="sm"
                        className="gap-1.5 text-xs font-semibold rounded-lg h-8 px-3.5 glass-btn-indigo-solid active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shadow-xs"
                      >
                        <Plus className="size-3.5" />
                        <span>Publish experiment</span>
                      </Button>
                    </>
                  ) : (
                    <Link href={`/classrooms/${classroomId}/compile-journal`}>
                      <Button
                        size="sm"
                        className="gap-2 text-xs font-semibold rounded-lg h-8 px-3.5 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap glass-btn-frosted shadow-xs"
                        title="Compile all practical experiments into an official master lab manual"
                      >
                        <BookOpen className={cn("size-3.5", theme.accentText)} />
                        <span>Download complete journal</span>
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>

        {/* Tab switcher & Action bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border pb-3">
          {/* Segmented Control Pill (Locked Height, Zero-Jitter, No Scrollbar) */}
          <div className="flex items-center p-0.5 border border-border bg-muted/40 rounded-md max-w-fit gap-1 shrink-0">
            <button
              onClick={() => setActiveTab("assignments")}
              className={`flex items-center gap-1.5 h-7.5 px-3 text-xs font-medium rounded transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "assignments"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText
                className={cn(
                  "size-3.5",
                  activeTab === "assignments" ? theme.accentText : "text-muted-foreground"
                )}
              />
              <span>Practicals</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded text-[10px] font-semibold tabular-nums",
                  activeTab === "assignments"
                    ? "bg-muted text-foreground border border-border"
                    : "text-muted-foreground"
                )}
              >
                {assignments?.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("announcements")}
              className={`flex items-center gap-1.5 h-7.5 px-3 text-xs font-medium rounded transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "announcements"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className={cn("size-3.5", activeTab === "announcements" ? theme.accentText : "text-muted-foreground")} />
              <span>Announcements</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold tabular-nums ${
                activeTab === "announcements" ? "bg-muted text-foreground border border-border" : "text-muted-foreground"
              }`}>
                {announcements?.length || 0}
              </span>
            </button>

            {isTeacher && (
              <button
                onClick={() => setActiveTab("submissions")}
                className={`flex items-center gap-1.5 h-7.5 px-3 text-xs font-medium rounded transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "submissions"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <GraduationCap className={cn("size-3.5", activeTab === "submissions" ? theme.accentText : "text-muted-foreground")} />
                <span>Gradebook</span>
                {pendingReviewsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold tabular-nums bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                    {pendingReviewsCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => setActiveTab("roster")}
              className={`flex items-center gap-1.5 h-7.5 px-3 text-xs font-medium rounded transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "roster"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className={cn("size-3.5", activeTab === "roster" ? theme.accentText : "text-muted-foreground")} />
              <span>Members</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold tabular-nums ${
                activeTab === "roster" ? "bg-muted text-foreground border border-border" : "text-muted-foreground"
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
                className="gap-1.5 text-xs font-medium rounded-md h-8 px-3 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="size-3.5" />
                <span>Post announcement</span>
              </Button>
            )}

            {/* When on Gradebook (Submissions): Full Gradebook Matrix link */}
            {activeTab === "submissions" && isTeacher && (
              <Link href={`/classrooms/${classroomId}/grades`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs font-semibold rounded-lg h-8 px-3.5 cursor-pointer whitespace-nowrap glass-btn-frosted shadow-xs"
                >
                  <LayoutGrid className={cn("size-3.5", theme.accentText)} />
                  <span>Full gradebook matrix</span>
                </Button>
              </Link>
            )}

            {/* When on Members (Roster): Copy Join Code quick action */}
            {activeTab === "roster" && (
              <Button
                onClick={handleCopyCode}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-medium rounded-md h-8 px-3 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap border-border hover:bg-muted"
                title="Copy student join code"
              >
                {copiedCode ? <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="size-3.5 text-muted-foreground" />}
                <span>{copiedCode ? "Copied" : <>Join code: <code className="font-mono font-semibold">{classroom?.joinCode || ""}</code></>}</span>
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
              <div className="flex items-center justify-center p-12 rounded-lg border border-border bg-card">
                <p className="text-xs text-muted-foreground animate-pulse">Loading announcements...</p>
              </div>
            ) : announcements && announcements.length > 0 ? (
              <div className="flex flex-col gap-3">
                {announcements.map((ann: any) => (
                  <div key={ann.id} className="p-5 rounded-lg border border-border bg-card shadow-xs flex flex-col gap-3 relative">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded bg-muted text-foreground border border-border flex items-center justify-center font-bold text-xs uppercase">
                          {ann.authorName?.[0] || "T"}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground">{ann.authorName}</span>
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {formatDateTimeIST(ann.createdAt, false)}
                          </span>
                        </div>
                      </div>
                      {ann.targetBatch && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-foreground border border-border">
                          {ann.targetBatch} only
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-foreground">{ann.title}</h3>
                    <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{ann.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-dashed border-border bg-card gap-2.5">
                <Sparkles className="size-6 text-muted-foreground mb-1" />
                <h3 className="text-sm font-bold text-foreground">No announcements yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {isTeacher
                    ? "Post an announcement to notify students in your classroom or specific lab batches."
                    : "Your teacher has not posted any announcements for this classroom."}
                </p>
                {isTeacher && (
                  <Button
                    onClick={() => setShowAnnouncementModal(true)}
                    size="sm"
                    className="mt-2 text-xs font-medium rounded-md h-8 px-3"
                  >
                    Post first announcement
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : activeTab === "assignments" ? (
          <div className="flex flex-col gap-5">
            {assignments && assignments.length > 0 ? (
              isTeacher ? (
                <>
                  {/* 1. Render Grouped Clusters with Archival Section Accordions (Hallmark Rule 11 Compliant) */}
                  {existingClusterNames.map((cName) => {
                    const cAssignments = clusterGroups.clusters[cName];
                    const isCollapsed = collapsedClusters.includes(cName);
                    return (
                      <div key={cName} className="flex flex-col gap-3">
                        {/* Archival Cluster Section Header Strip (Borderless Flow) */}
                        <div
                          onClick={() => toggleClusterCollapse(cName)}
                          className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-muted/40 transition-all select-none group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="size-6 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold shrink-0">
                              <Folder className="size-3 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="flex items-center gap-2 truncate">
                              <h3 className="font-bold text-sm text-foreground tracking-tight">{cName}</h3>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tabular-nums bg-muted text-muted-foreground border border-border/80 shrink-0">
                                {cAssignments.length} {cAssignments.length === 1 ? "practical" : "practicals"}
                              </span>
                            </div>
                          </div>

                          <div className="flex-1 h-px bg-border/60 mx-3 hidden sm:block" />

                          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => disbandClusterMutation.mutate(cName)}
                              disabled={disbandClusterMutation.isPending}
                              className="text-xs text-muted-foreground hover:text-destructive h-7 px-2.5 rounded cursor-pointer transition-colors"
                              title="Disband cluster"
                            >
                              <FolderX className="size-3 mr-1" />
                              <span>Disband</span>
                            </Button>

                            <button
                              type="button"
                              onClick={() => toggleClusterCollapse(cName)}
                              className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer transition-transform"
                              title={isCollapsed ? "Expand cluster" : "Collapse cluster"}
                            >
                              <ChevronDown className={`size-4 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`} />
                            </button>
                          </div>
                        </div>

                        {/* Clustered Practicals with Clean Structural Left Accent Guide */}
                        {!isCollapsed && (
                          <div className="flex flex-col gap-3 pl-3 sm:pl-4 border-l-2 border-indigo-500/30 dark:border-indigo-500/40 ml-2.5 sm:ml-3 animate-in fade-in-50 duration-200">
                            {cAssignments.map((asg) => renderAssignmentCard(asg, true))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* 2. Render Independent / General Curriculum Practicals */}
                  {clusterGroups.unclustered.length > 0 && (
                    <div className="flex flex-col gap-2.5 mt-1">
                      {existingClusterNames.length > 0 && (
                        <div className="flex items-center gap-2 px-1 pt-2">
                          <FileText className="size-3.5 text-muted-foreground" />
                          <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                            Independent practicals ({clusterGroups.unclustered.length})
                          </h4>
                          <div className="flex-1 h-px bg-border ml-2" />
                        </div>
                      )}
                      <div className="flex flex-col gap-2.5">
                        {clusterGroups.unclustered.map((asg) => renderAssignmentCard(asg, false))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Flat Sequential List for Students */
                <div className="flex flex-col gap-2.5">
                  {[...assignments]
                    .sort((a, b) => a.experimentNumber - b.experimentNumber)
                    .map((asg) => renderAssignmentCard(asg, false))}
                </div>
              )
            ) : (
              <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg bg-card">
                <div className="size-10 rounded bg-muted text-muted-foreground flex items-center justify-center mb-3 border border-border">
                  <FileText className="size-5" />
                </div>
                <h4 className="font-bold text-base tracking-tight font-serif">No experiments published</h4>
                <p className="text-xs text-muted-foreground mt-1 text-center max-w-sm leading-relaxed">
                  {isTeacher
                    ? "Click 'Publish experiment' above to create a new lab assignment for your students."
                    : "Your teacher has not published any lab assignments in this workspace yet."}
                </p>
                {isTeacher && (
                  <Button
                    onClick={() => {
                      setEditingAssignment(null);
                      setShowPublishModal(true);
                    }}
                    size="sm"
                    className="mt-4 rounded-md font-medium text-xs h-8 px-3 shadow-xs"
                  >
                    <Plus className="size-3.5 mr-1.5" />
                    Publish experiment now
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : activeTab === "submissions" ? (
          <div className="flex flex-col gap-4">
            {/* Division & Batch Filter Strip */}
            <div className="flex flex-col gap-2 pb-1">
              {/* Division Filter */}
              {availableDivisions.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <span className="text-xs font-medium text-muted-foreground mr-1">Division:</span>
                  <button
                    onClick={() => setSelectedDivision("ALL")}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                      selectedDivision === "ALL"
                        ? "bg-foreground text-background font-bold shadow-xs"
                        : "border border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All divisions
                  </button>
                  {availableDivisions.map((d: string) => (
                    <button
                      key={d}
                      onClick={() => setSelectedDivision(d)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                        selectedDivision === d
                          ? "bg-foreground text-background font-bold shadow-xs"
                          : "border border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Div {d}
                    </button>
                  ))}
                </div>
              )}

              {/* Batch Filter Pills */}
              {classroom?.batches && classroom.batches.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <span className="text-xs font-medium text-muted-foreground mr-1">Batch:</span>
                  <button
                    onClick={() => setSelectedBatch("ALL")}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                      selectedBatch === "ALL"
                        ? "bg-foreground text-background font-bold shadow-xs"
                        : "border border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All batches
                  </button>
                  {classroom.batches.map((b: string) => (
                    <button
                      key={b}
                      onClick={() => setSelectedBatch(b)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                        selectedBatch === b
                          ? "bg-foreground text-background font-bold shadow-xs"
                          : "border border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {submissionsLoading ? (
              <p className="text-xs text-muted-foreground animate-pulse">
                Loading student submissions...
              </p>
            ) : !submissions || submissions.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg bg-card">
                <div className="size-10 rounded bg-muted text-muted-foreground flex items-center justify-center mb-3 border border-border">
                  <GraduationCap className="size-5" />
                </div>
                <h4 className="font-bold text-base tracking-tight font-serif">No submissions yet</h4>
                <p className="text-xs text-muted-foreground mt-1 text-center max-w-sm leading-relaxed">
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
                    className="p-4 rounded-lg border border-border bg-card shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-foreground/40 transition-all"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold tabular-nums bg-muted text-foreground border border-border">
                          Exp #{sub.experimentNumber}
                        </span>
                        <h4 className="font-bold text-sm text-foreground">
                          {sub.studentName} <span className="font-mono font-normal text-muted-foreground">({sub.enrollmentNumber || "No Enr."})</span>
                        </h4>
                        {sub.studentBatch && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-foreground border border-border">
                            {sub.studentBatch}
                          </span>
                        )}
                        {sub.isRevoked && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            Revoked submission
                          </span>
                        )}
                        {(sub.isLate || sub.status === "late_submitted") && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                            Late submission
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {sub.assignmentTitle} • {sub.submittedAt ? `Handed in ${formatDateIST(sub.submittedAt)}` : "In progress"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                          sub.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                            : sub.status === "submitted" || sub.status === "late_submitted"
                            ? "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30"
                            : sub.status === "changes_requested"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                            : "bg-muted text-foreground border-border"
                        }`}
                      >
                        {sub.status === "approved"
                          ? `Approved (${sub.marks}/${sub.maxMarks})`
                          : sub.status === "submitted" || sub.status === "late_submitted"
                          ? "Submitted"
                          : sub.status === "changes_requested"
                          ? "Changes requested"
                          : "Draft"}
                      </span>

                      {sub.isRevoked ? (
                        <Button
                          disabled
                          size="sm"
                          variant="outline"
                          className="font-medium rounded-md h-8 px-3 text-xs opacity-60 cursor-not-allowed"
                        >
                          Revoked
                        </Button>
                      ) : sub.status === "approved" ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="font-semibold rounded-md h-8 px-3 text-xs glass-btn-emerald-outline shadow-xs active:scale-[0.98] transition-all cursor-pointer gap-1.5"
                        >
                          <Link href={`/editor/${sub.id}`}>
                            <span>View evaluation</span>
                            <ArrowUpRight className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                          </Link>
                        </Button>
                      ) : sub.status === "submitted" || sub.status === "late_submitted" ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="font-semibold rounded-md h-8 px-3 text-xs glass-btn-amber shadow-xs active:scale-[0.98] transition-all cursor-pointer gap-1.5"
                        >
                          <Link href={`/editor/${sub.id}`}>
                            <span>Review journal</span>
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </Button>
                      ) : sub.status === "changes_requested" ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="font-semibold rounded-md h-8 px-3 text-xs glass-btn-amber shadow-xs active:scale-[0.98] transition-all cursor-pointer gap-1.5"
                        >
                          <Link href={`/editor/${sub.id}`}>
                            <span>Review revision</span>
                            <FileEdit className="size-3.5" />
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="font-medium rounded-md h-8 px-3 text-xs glass-btn-frosted shadow-xs active:scale-[0.98] transition-all cursor-pointer gap-1.5"
                        >
                          <Link href={`/editor/${sub.id}`}>
                            <Eye className="size-3.5 text-muted-foreground" />
                            <span>Preview draft</span>
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {membersLoading ? (
              <p className="text-xs text-muted-foreground animate-pulse">
                Loading roster members...
              </p>
            ) : members && members.length > 0 ? (
              members.map((member) => (
                <div
                  key={member.studentId}
                  className="p-3.5 rounded-lg border border-border bg-card flex items-center justify-between gap-4 shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded bg-muted text-foreground font-bold text-xs flex items-center justify-center border border-border uppercase">
                      {(member.name || member.email || "S").substring(0, 2)}
                    </div>
                    <div className="flex flex-col">
                      <h4 className="font-bold text-sm text-foreground">
                        {member.name || member.email}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Enrollment: <span className="font-mono">{member.enrollmentNumber}</span> • Joined {formatDateIST(member.joinedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg bg-card">
                <div className="size-10 rounded bg-muted text-muted-foreground flex items-center justify-center mb-3 border border-border">
                  <Users className="size-5" />
                </div>
                <h4 className="font-bold text-base tracking-tight font-serif">No roster members yet</h4>
                <p className="text-xs text-muted-foreground mt-1 text-center max-w-sm leading-relaxed">
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

      {/* Publish & Edit Assignment Modal (Teacher only) */}
      <PublishExperimentModal
        isOpen={showPublishModal}
        onClose={() => {
          setShowPublishModal(false);
          setEditingAssignment(null);
        }}
        classroomId={classroomId}
        classroomBatches={classroom?.batches || []}
        existingClusterNames={existingClusterNames}
        mode={editingAssignment ? "edit" : "create"}
        initialData={editingAssignment}
        hasGradedSubmissions={
          editingAssignment ? isAssignmentGraded(editingAssignment.id) : false
        }
      />

      {/* Publish Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg p-6 rounded-lg bg-card border border-border shadow-lg flex flex-col gap-4 relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h3 className="font-serif font-bold text-base text-foreground">Post classroom announcement</h3>
              </div>
              <button
                onClick={() => setShowAnnouncementModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm p-1 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 mt-1">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Announcement title</label>
                <input
                  type="text"
                  placeholder="e.g. Schedule for Batch A1 Practicals"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {classroom?.batches && classroom.batches.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Target batch (optional)</label>
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
                    buttonClassName="h-9 px-3 rounded-md bg-background border-input text-xs"
                    renderMath={false}
                  />
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Content message</label>
                <textarea
                  placeholder="Write your announcement details here..."
                  rows={4}
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex items-center gap-2.5 justify-end mt-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAnnouncementModal(false)} className="rounded-md h-8 px-3 text-xs">
                  Cancel
                </Button>
                <Button
                  size="sm"
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
                  className="rounded-md h-8 px-3 text-xs"
                >
                  {postAnnouncementMutation.isPending ? "Posting..." : "Post announcement"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cluster Manager Modal */}
      {showClusterModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="bg-card border border-border shadow-lg w-full max-w-lg p-6 rounded-lg flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <h3 className="font-serif font-bold text-base tracking-tight text-foreground">Manage practical clusters</h3>
              </div>
              <button
                onClick={() => setShowClusterModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Clusters group practical experiments into evaluation modules or continuous assessment cycles.
              Disbanding a cluster never deletes student journals or marks; it simply returns the practicals to standalone status.
            </p>

            {/* Existing Clusters List */}
            <div className="flex flex-col gap-2 mt-1">
              {existingClusterNames.length === 0 ? (
                <div className="p-6 text-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                  No clusters created yet. Use the card action menu or the form below to create your first cluster.
                </div>
              ) : (
                existingClusterNames.map((cName) => {
                  const count = clusterGroups.clusters[cName]?.length || 0;
                  return (
                    <div
                      key={cName}
                      className="p-3 rounded-md bg-muted/40 border border-border flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <Folder className="size-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <h4 className="text-xs font-bold text-foreground">{cName}</h4>
                          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                            {count} {count === 1 ? "experiment" : "experiments"}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => disbandClusterMutation.mutate(cName)}
                        disabled={disbandClusterMutation.isPending}
                        className="text-xs text-destructive hover:bg-destructive/10 h-7 px-2.5 rounded cursor-pointer"
                      >
                        <FolderX className="size-3 mr-1" />
                        Disband
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Create New Cluster Row */}
            <div className="flex flex-col gap-1.5 pt-3 border-t border-border">
              <label className="text-xs font-medium text-muted-foreground">Create new cluster name</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. Cycle 1: DC Circuits & Network Theorems"
                  value={newClusterName}
                  onChange={(e) => setNewClusterName(e.target.value)}
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                  className="h-9 px-3 rounded-lg text-xs font-semibold cursor-pointer glass-btn-indigo-solid shadow-xs"
                >
                  Create
                </Button>
              </div>
            </div>

            <div className="flex justify-end mt-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setShowClusterModal(false)} className="rounded-lg h-8 px-3.5 text-xs font-medium cursor-pointer glass-btn-frosted shadow-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Multi-Select Bulk Action Bar for Teachers */}
      {isTeacher && selectedAssignmentIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card text-foreground border border-border shadow-lg rounded-md px-4 py-2.5 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-150">
          <span className="text-xs font-bold tabular-nums whitespace-nowrap">
            {selectedAssignmentIds.length} {selectedAssignmentIds.length === 1 ? "experiment" : "experiments"} selected
          </span>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-2">
            <GlassDropdown
              value=""
              placeholder="Move to cluster..."
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
              buttonClassName="h-7.5 px-2.5 bg-muted hover:bg-muted/80 text-foreground border-border rounded text-xs"
              menuClassName="w-52"
              renderMath={false}
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedAssignmentIds([])}
              className="text-xs text-muted-foreground hover:text-foreground h-7 px-2 rounded cursor-pointer"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
