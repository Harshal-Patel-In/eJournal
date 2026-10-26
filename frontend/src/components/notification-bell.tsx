"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  Check,
  Loader2,
  MailOpen,
  BookOpen,
  FileCheck,
  FileEdit,
  GraduationCap,
  Megaphone,
  ClockAlert,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FlaskConical,
  Layers,
  User,
  X,
  Search,
  ArrowUpRight,
  HelpCircle,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatRelativeTimeIST, formatDateTimeIST } from "@/lib/date";
import {
  resolveNotificationCategory,
  resolveNotificationTarget,
  getCategoryDisplayMeta,
} from "@/lib/notification-resolver";

interface CategoryStack {
  id: string;
  categoryName: string;
  intent: any;
  items: any[];
  unreadCount: number;
}

interface StudentGroup {
  id: string;
  studentName: string;
  items: any[];
  categoryStacks: CategoryStack[];
  unreadCount: number;
}

interface ExperimentGroup {
  id: string;
  name: string;
  sortIndex: number;
  items: any[];
  students: StudentGroup[];
  categoryStacks: CategoryStack[];
  unreadCount: number;
}

function getNotificationIntent(notif: any, isTeacher: boolean = true, hasJournal: boolean = false) {
  const category = resolveNotificationCategory(notif);
  const meta = getCategoryDisplayMeta(category, isTeacher, hasJournal);

  let icon = <Bell className="size-4 text-primary shrink-0" />;
  if (meta.iconType === "help-circle") {
    icon = <HelpCircle className="size-4 text-purple-600 dark:text-purple-400 shrink-0" />;
  } else if (meta.iconType === "sparkles") {
    icon = <Sparkles className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />;
  } else if (meta.iconType === "alert-triangle") {
    icon = <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400 shrink-0" />;
  } else if (meta.iconType === "message-square") {
    icon = <MessageSquare className="size-4 text-sky-600 dark:text-sky-400 shrink-0" />;
  } else if (meta.iconType === "clock-alert") {
    icon = <ClockAlert className="size-4 text-rose-600 dark:text-rose-400 shrink-0" />;
  } else if (meta.iconType === "file-check") {
    icon = <FileCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
  } else if (meta.iconType === "file-edit") {
    icon = <FileEdit className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />;
  } else if (meta.iconType === "graduation") {
    icon = <GraduationCap className="size-4 text-teal-600 dark:text-teal-400 shrink-0" />;
  } else if (meta.iconType === "book") {
    icon = <BookOpen className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />;
  } else if (meta.iconType === "megaphone") {
    icon = <Megaphone className="size-4 text-cyan-600 dark:text-cyan-400 shrink-0" />;
  }

  return {
    ...meta,
    icon,
  };
}

/**
 * Normalizes experiment titles so "Experiment 1", "Experiment #1:", "Experiment 1:"
 * all unify into "Experiment #1".
 */
function getNormalizedExperimentGroup(notif: any): { id: string; name: string; sortIndex: number } {
  const text = `${notif.title || ""} ${notif.message || ""}`;

  const expMatch = text.match(/Experiment\s*#?\s*(\d+)/i);
  if (expMatch && expMatch[1]) {
    const num = parseInt(expMatch[1], 10);
    return { id: `exp_${num}`, name: `Experiment #${num}`, sortIndex: num };
  }

  const labMatch = text.match(/(?:Lab|Practical)\s*#?\s*(\d+)/i);
  if (labMatch && labMatch[1]) {
    const num = parseInt(labMatch[1], 10);
    return { id: `exp_${num}`, name: `Practical #${num}`, sortIndex: num };
  }

  if (notif.type === "announcement" || text.toLowerCase().includes("announcement")) {
    return { id: "announcements", name: "Classroom Announcements", sortIndex: 998 };
  }

  return { id: "general", name: "General Activity", sortIndex: 999 };
}

/**
 * Robust student extraction for Teacher's classroom notifications:
 * Extracts "Harshal Patel" from "Harshal Patel has handed in the journal..."
 */
function getStudentName(notif: any): string {
  if (notif.metadata?.studentName) {
    return notif.metadata.studentName;
  }

  // Check the notification message first (e.g. "Harshal Patel has handed in the journal for Experiment #1")
  const message = (notif.message || "").trim();

  // Pattern: starts with student name: "Harshal Patel has handed in..." or "Harshal Patel submitted..."
  const startMatch = message.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s+(?:has|submitted|handed|requested|uploaded|commented)\b/);
  if (startMatch && startMatch[1]) {
    return startMatch[1].trim();
  }

  // Pattern: student name anywhere before action verb
  const anywhereMatch = message.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:has|submitted|handed|uploaded)\b/);
  if (anywhereMatch && anywhereMatch[1]) {
    const candidate = anywhereMatch[1].trim();
    if (
      !candidate.toLowerCase().includes("journal") &&
      !candidate.toLowerCase().includes("submission") &&
      !candidate.toLowerCase().includes("assignment")
    ) {
      return candidate;
    }
  }


  // Title starting with a student name (excluding known titles)
  const title = (notif.title || "").trim();
  const titleMatch = title.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
  if (
    titleMatch &&
    titleMatch[1] &&
    !["New Assignment", "Journal Approved", "Journal Submission", "Changes Requested", "Experiment Assignment"].includes(titleMatch[1])
  ) {
    return titleMatch[1].trim();
  }

  return "Classroom Student";
}


function formatRelativeTime(dateStr: string): string {
  return formatRelativeTimeIST(dateStr);
}

// Apple-style Monogram Avatar palettes with soft pastel tints
const AVATAR_PALETTES = [
  { bg: "bg-violet-500/10 dark:bg-violet-500/20", text: "text-violet-600 dark:text-violet-400", border: "border-violet-500/25" },
  { bg: "bg-indigo-500/10 dark:bg-indigo-500/20", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/25" },
  { bg: "bg-emerald-500/10 dark:bg-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/25" },
  { bg: "bg-amber-500/10 dark:bg-amber-500/20", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/25" },
  { bg: "bg-rose-500/10 dark:bg-rose-500/20", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/25" },
  { bg: "bg-sky-500/10 dark:bg-sky-500/20", text: "text-sky-600 dark:text-sky-400", border: "border-sky-500/25" },
  { bg: "bg-teal-500/10 dark:bg-teal-500/20", text: "text-teal-600 dark:text-teal-400", border: "border-teal-500/25" },
  { bg: "bg-cyan-500/10 dark:bg-cyan-500/20", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/25" },
];

function getStudentAvatarInfo(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  let initials = "ST";
  if (parts.length >= 2) {
    initials = `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  } else if (parts.length === 1 && parts[0].length >= 2) {
    initials = parts[0].substring(0, 2).toUpperCase();
  } else if (parts.length === 1) {
    initials = parts[0][0].toUpperCase();
  }

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];

  return { initials, ...palette };
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "unread">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Tier 1: Single expanded experiment ID (Auto-collapses other experiments)
  const [expandedExpId, setExpandedExpId] = useState<string | null>(null);

  // Tier 2: Single expanded student ID (Teacher view, auto-collapses other students)
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // Tier 3: Single active unstacked category stack ID (Auto-collapses other category stacks)
  const [unstackedCategoryId, setUnstackedCategoryId] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [bellPulsing, setBellPulsing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close drawer on outside click, Escape key & lock body scroll while open
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Fetch user profile to determine role (Teacher vs Student)
  const { data: user } = useQuery<any>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile"),
  });
  const isTeacher = user?.role === "teacher";

  // Fetch student journals if user is student to enable instant deep-linking into the journal
  const { data: studentJournalsRes } = useQuery<any>({
    queryKey: ["student-journals"],
    queryFn: () => api.get("/journals"),
    enabled: !isTeacher && mounted,
  });
  const studentJournals: any[] = useMemo(() => {
    return Array.isArray(studentJournalsRes) ? studentJournalsRes : studentJournalsRes?.data || [];
  }, [studentJournalsRes]);

  const findStudentJournalForNotif = (notif: any) => {
    // 1. If notif already has direct journal link in link (e.g. /editor/6a5cf4904e8114f803ae84e2)
    if (notif.link && notif.link.startsWith("/editor/")) {
      const linkId = notif.link.replace("/editor/", "").split("?")[0];
      return { id: linkId, _id: linkId, status: "approved" };
    }

    // 2. Direct journalId or entityId in metadata
    const directId = notif.metadata?.journalId || (notif.metadata?.entityType === "journals" ? notif.metadata?.entityId : null);
    if (directId) {
      if (studentJournals && studentJournals.length > 0) {
        const match = studentJournals.find((j: any) => (j.id || j._id) === directId);
        if (match) return match;
      }
      return { id: directId, _id: directId };
    }

    if (!studentJournals || studentJournals.length === 0) return null;

    // 3. AssignmentId in metadata or link query
    let asgId = notif.metadata?.assignmentId;
    if (!asgId && notif.link && notif.link.includes("assignment")) {
      const match = notif.link.match(/assignment(?:Id)?=([a-f0-9]+)/i);
      if (match) asgId = match[1];
    }
    if (asgId) {
      const match = studentJournals.find((j: any) => j.assignmentId === asgId);
      if (match) return match;
    }

    // 4. Match by experiment number in normalized group:
    const expGroup = getNormalizedExperimentGroup(notif);
    if (expGroup.sortIndex && expGroup.sortIndex < 900) {
      const expNum = expGroup.sortIndex;
      const match = studentJournals.find((j: any) => {
        const title = (j.title || "").toLowerCase();
        const numMatch = title.match(/(?:Experiment|Practical|Lab)\s*#?\s*(\d+)/i);
        if (numMatch && parseInt(numMatch[1], 10) === expNum) {
          return true;
        }
        return false;
      });
      if (match) return match;
    }

    return null;
  };

  // Real-Time WebSocket Notification Streaming
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;
    let isMounted = true;

    function connect() {
      if (typeof window === "undefined" || !isMounted) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      let defaultHost = "localhost:8000";
      if (process.env.NEXT_PUBLIC_API_URL) {
        try {
          const url = new URL(process.env.NEXT_PUBLIC_API_URL, window.location.origin);
          defaultHost = url.host;
        } catch {
          // Fallback to localhost if malformed
        }
      }
      const host = process.env.NEXT_PUBLIC_WS_HOST || defaultHost;
      const wsUrl = `${protocol}//${host}/api/v1/notifications/ws`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "NEW_NOTIFICATION") {
              const notif = data.notification || {};
              const notifType = (notif.type || "").toLowerCase();
              const metadata = notif.metadata || {};
              const classroomId = metadata.classroomId;

              // 1. Always invalidate the notifications list & badge counter
              queryClient.invalidateQueries({ queryKey: ["notifications"] });

              // 2. Real-Time Domain Invalidation for Active Pages:
              if (notifType === "assignment") {
                if (classroomId) {
                  queryClient.invalidateQueries({ queryKey: ["assignments", classroomId] });
                  queryClient.invalidateQueries({ queryKey: ["classroom", classroomId] });
                  queryClient.invalidateQueries({ queryKey: ["gradebook", classroomId] });
                }
                queryClient.invalidateQueries({ queryKey: ["assignments"] });
              } else if (notifType === "announcement") {
                if (classroomId) {
                  queryClient.invalidateQueries({ queryKey: ["announcements", classroomId] });
                  queryClient.invalidateQueries({ queryKey: ["classroom", classroomId] });
                }
                queryClient.invalidateQueries({ queryKey: ["announcements"] });
              } else if (
                notifType === "submission" ||
                notifType === "changes_requested" ||
                notifType === "approval" ||
                notifType === "approved" ||
                notifType === "graded"
              ) {
                if (classroomId) {
                  queryClient.invalidateQueries({ queryKey: ["submissions", classroomId] });
                  queryClient.invalidateQueries({ queryKey: ["my-submissions", classroomId] });
                  queryClient.invalidateQueries({ queryKey: ["gradebook", classroomId] });
                  queryClient.invalidateQueries({ queryKey: ["classroom", classroomId] });
                }
                queryClient.invalidateQueries({ queryKey: ["journals"] });
                queryClient.invalidateQueries({ queryKey: ["student-journals"] });
                const targetJournalId = metadata.entityId || metadata.journalId;
                if (targetJournalId) {
                  queryClient.invalidateQueries({ queryKey: ["journal", targetJournalId] });
                }
              } else if (notifType === "comment" || notifType === "annotation") {
                const targetJournalId = metadata.entityId || metadata.journalId;
                if (targetJournalId) {
                  queryClient.invalidateQueries({ queryKey: ["annotations", targetJournalId] });
                }
              } else {
                if (classroomId) {
                  queryClient.invalidateQueries({ queryKey: ["classroom", classroomId] });
                }
              }

              setBellPulsing(true);
              setTimeout(() => setBellPulsing(false), 2500);

              try {
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioCtx) {
                  const ctx = new AudioCtx();
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  osc.type = "sine";
                  osc.frequency.setValueAtTime(587.33, ctx.currentTime);
                  osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
                  gain.gain.setValueAtTime(0.06, ctx.currentTime);
                  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  osc.start();
                  osc.stop(ctx.currentTime + 0.35);
                }
              } catch {
                // Audio autoplay restriction ignored
              }
            }
          } catch {
            // Non-json ping ignored
          }
        };

        ws.onclose = () => {
          if (isMounted) reconnectTimer = setTimeout(connect, 3000);
        };
        ws.onerror = () => ws?.close();
      } catch {
        if (isMounted) reconnectTimer = setTimeout(connect, 5000);
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [queryClient]);

  // 1. Fetch user notifications
  const { data: response, isLoading } = useQuery<any>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications"),
    refetchOnWindowFocus: true,
  });

  const notifications: any[] = Array.isArray(response) ? response : response?.data || [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const visibleNotifications = useMemo(() => {
    let list = notifications;
    if (filterMode === "unread") {
      list = list.filter((n: any) => !n.isRead);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((n: any) => {
        const title = (n.title || "").toLowerCase();
        const msg = (n.message || "").toLowerCase();
        const student = getStudentName(n).toLowerCase();
        const exp = getNormalizedExperimentGroup(n).name.toLowerCase();
        const cat = getNotificationIntent(n).category.toLowerCase();
        return (
          title.includes(q) ||
          msg.includes(q) ||
          student.includes(q) ||
          exp.includes(q) ||
          cat.includes(q)
        );
      });
    }
    return list;
  }, [notifications, filterMode, searchQuery]);

  // Helper to build category stacks for a collection of notifications
  const buildCategoryStacks = (prefix: string, items: any[]): CategoryStack[] => {
    const catMap = new Map<string, any[]>();
    items.forEach((item) => {
      const studentJournal = !isTeacher ? findStudentJournalForNotif(item) : null;
      const intent = getNotificationIntent(item, isTeacher, !!studentJournal);
      const catKey = intent.category;
      if (!catMap.has(catKey)) {
        catMap.set(catKey, []);
      }
      catMap.get(catKey)!.push(item);
    });

    return Array.from(catMap.entries()).map(([catKey, catItems]) => {
      const topJournal = !isTeacher ? findStudentJournalForNotif(catItems[0]) : null;
      return {
        id: `${prefix}_${catKey}`.replace(/\s+/g, "_"),
        categoryName: catKey,
        intent: getNotificationIntent(catItems[0], isTeacher, !!topJournal),
        items: catItems,
        unreadCount: catItems.filter((i) => !i.isRead).length,
      };
    });
  };

  // Build role-aware tree:
  // Teacher: Experiment -> Student -> Category Stack
  // Student: Experiment -> Category Stack
  const groupedNotifications: ExperimentGroup[] = useMemo(() => {
    const expMap = new Map<string, { id: string; name: string; sortIndex: number; items: any[] }>();

    visibleNotifications.forEach((notif) => {
      const { id, name, sortIndex } = getNormalizedExperimentGroup(notif);
      if (!expMap.has(id)) {
        expMap.set(id, { id, name, sortIndex, items: [] });
      }
      expMap.get(id)!.items.push(notif);
    });

    return Array.from(expMap.values())
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .map((exp) => {
        if (isTeacher) {
          // Teacher View: Subdivide by Student
          const studentMap = new Map<string, any[]>();
          exp.items.forEach((item) => {
            const sName = getStudentName(item);
            if (!studentMap.has(sName)) {
              studentMap.set(sName, []);
            }
            studentMap.get(sName)!.push(item);
          });

          const students: StudentGroup[] = Array.from(studentMap.entries()).map(([sName, sItems]) => {
            const studentPrefix = `${exp.id}_${sName}`.replace(/\s+/g, "_");
            return {
              id: studentPrefix,
              studentName: sName,
              items: sItems,
              categoryStacks: buildCategoryStacks(studentPrefix, sItems),
              unreadCount: sItems.filter((i) => !i.isRead).length,
            };
          });

          return {
            id: exp.id,
            name: exp.name,
            sortIndex: exp.sortIndex,
            items: exp.items,
            students,
            categoryStacks: [],
            unreadCount: exp.items.filter((i) => !i.isRead).length,
          };
        } else {
          // Student View: Directly categorize stacks under experiment
          return {
            id: exp.id,
            name: exp.name,
            sortIndex: exp.sortIndex,
            items: exp.items,
            students: [],
            categoryStacks: buildCategoryStacks(exp.id, exp.items),
            unreadCount: exp.items.filter((i) => !i.isRead).length,
          };
        }
      });
  }, [visibleNotifications, isTeacher, studentJournals]);

  // Auto-expand default: Open first experiment with unread items, first experiment, or on search
  useEffect(() => {
    if (isOpen) {
      const targetExp = groupedNotifications.find((g) => g.unreadCount > 0) || groupedNotifications[0];
      if (targetExp) {
        setExpandedExpId(targetExp.id);
        if (isTeacher && targetExp.students.length > 0) {
          const targetStudent = targetExp.students.find((s) => s.unreadCount > 0) || targetExp.students[0];
          setExpandedStudentId(targetStudent.id);
        }
      }
    }
  }, [isOpen, groupedNotifications.length, isTeacher, searchQuery]);

  // Mark single notification as read
  const readMutation = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Mark all as read
  const readAllMutation = useMutation({
    mutationFn: () => api.post("/notifications/read-all", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleNotificationClick = async (notif: any) => {
    if (!notif.isRead) {
      readMutation.mutate(notif.id);
    }
    setIsOpen(false);

    const studentJournal = !isTeacher ? findStudentJournalForNotif(notif) : null;
    const studentJournalId = studentJournal?.id || studentJournal?._id || null;

    // STUDENT VIEW: When a student clicks an assignment notification and has no journal yet,
    // start or open the journal via POST /journals
    if (!isTeacher && !studentJournalId && (notif.category === "assignment" || notif.type === "assignment")) {
      let asgId =
        (notif.entityType === "assignment" ? notif.entityId : null) ||
        notif.metadata?.assignmentId;

      if (!asgId && notif.link && notif.link.includes("assignment")) {
        const match = notif.link.match(/assignment(?:Id)?=([a-f0-9]+)/i);
        if (match) asgId = match[1];
      }

      if (!asgId) {
        const classroomId =
          notif.classroomId ||
          notif.metadata?.classroomId ||
          (notif.link?.startsWith("/classrooms/")
            ? notif.link.replace("/classrooms/", "").split("?")[0].split("/")[0]
            : null);
        const expGroup = getNormalizedExperimentGroup(notif);
        if (classroomId && expGroup.sortIndex && expGroup.sortIndex < 900) {
          try {
            const asgs: any = await api.get(`/classrooms/${classroomId}/assignments`);
            const asgList: any[] = Array.isArray(asgs) ? asgs : asgs?.data || [];
            const matchedAsg = asgList.find((a: any) => a.experimentNumber === expGroup.sortIndex);
            if (matchedAsg) asgId = matchedAsg.id || matchedAsg._id;
          } catch (e) {
            console.error("Failed to fetch classroom assignments:", e);
          }
        }
      }

      if (asgId) {
        try {
          const res: any = await api.post("/journals", { assignmentId: asgId });
          const journalId = res?.id || res?._id || (typeof res === "string" ? res : null);
          if (journalId) {
            queryClient.invalidateQueries({ queryKey: ["student-journals"] });
            router.push(`/editor/${journalId}`);
            return;
          }
        } catch (e) {
          console.error("Failed to start/open journal for assignment:", e);
        }
      }
    }

    // RESOLVE TARGET FOR TEACHER & GENERAL
    const targetUrl = resolveNotificationTarget(notif, {
      isTeacher,
      studentJournalId,
    });

    if (targetUrl) {
      router.push(targetUrl);
    }
  };

  // Active Auto-Collapsing: clicking one experiment opens it and collapses the other
  const toggleExperiment = (expId: string) => {
    setUnstackedCategoryId(null);
    if (expandedExpId === expId) {
      setExpandedExpId(null);
      setExpandedStudentId(null);
    } else {
      setExpandedExpId(expId);
      if (isTeacher) {
        const exp = groupedNotifications.find((g) => g.id === expId);
        if (exp && exp.students.length > 0) {
          setExpandedStudentId(exp.students[0].id);
        }
      }
    }
  };

  // Active Auto-Collapsing for Student tier (Teacher view)
  const toggleStudent = (studentId: string) => {
    setUnstackedCategoryId(null);
    setExpandedStudentId((prev) => (prev === studentId ? null : studentId));
  };

  // Toggle Samsung One UI Category Stack with Active Auto-Collapsing
  const toggleCategoryStack = (stackId: string) => {
    setUnstackedCategoryId((prev) => (prev === stackId ? null : stackId));
  };

  // Render an individual notification card - Clean, aligned, Apple-grade card
  const renderSingleCard = (notif: any) => {
    const studentJournal = !isTeacher ? findStudentJournalForNotif(notif) : null;
    const intent = getNotificationIntent(notif, isTeacher, !!studentJournal);
    const relTime = formatRelativeTime(notif.createdAt);
    const isLate =
      (notif.message || "").toLowerCase().includes("late") ||
      (notif.title || "").toLowerCase().includes("late");

    const cleanedMessage = (notif.message || "")
      .replace(/\s*\((LATE SUBMISSION|LATE)\)/gi, "")
      .replace(/\s*\[(LATE SUBMISSION|LATE)\]/gi, "")
      .trim();

    return (
      <div
        key={notif.id}
        onClick={() => handleNotificationClick(notif)}
        className={`w-full p-3 text-left rounded-xl border transition-all duration-200 flex items-start gap-3 cursor-pointer group relative active:scale-[0.99] ${
          !notif.isRead
            ? "bg-violet-50/80 dark:bg-[#1a1824] border-violet-400/50 dark:border-violet-500/35 ring-1 ring-violet-500/20 shadow-xs dark:shadow-[0_2px_10px_rgba(0,0,0,0.4)]"
            : "bg-white dark:bg-[#18191e] border-zinc-200/90 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 shadow-xs dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
        }`}
      >
        {/* Squircle Icon */}
        <div
          className={`size-8 rounded-xl border ${intent.avatarBg} flex items-center justify-center shrink-0 mt-0.5 shadow-2xs dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-transform duration-200 group-hover:scale-105`}
        >
          {intent.icon}
        </div>

        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border shadow-2xs ${intent.badgeClass}`}
              >
                {intent.badgeText}
              </span>
              {!notif.isRead && (
                <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center gap-1 shadow-2xs">
                  <span className="size-1 rounded-full bg-rose-500 animate-pulse" />
                  <span>NEW</span>
                </span>
              )}
              {isLate && !intent.badgeText.toUpperCase().includes("LATE") && (
                <span className="px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 shadow-2xs">
                  LATE
                </span>
              )}
            </div>
            <span
              className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold shrink-0"
              title={formatDateTimeIST(notif.createdAt)}
            >
              {relTime}
            </span>
          </div>

          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-snug tracking-tight">
            {notif.title}
          </span>

          {cleanedMessage && (
            <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed line-clamp-2 font-medium break-words">
              {cleanedMessage}
            </p>
          )}
        </div>

        {/* Quick Actions & Trailing Affordance */}
        <div className="flex items-center gap-1 shrink-0 self-center">
          {!notif.isRead && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                readMutation.mutate(notif.id);
              }}
              title="Mark as read"
              aria-label="Mark as read"
              className="size-7 rounded-lg bg-zinc-100 hover:bg-emerald-500 hover:text-white dark:bg-zinc-800 dark:hover:bg-emerald-500 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow-2xs active:scale-90"
            >
              <Check className="size-3.5" />
            </button>
          )}
          {(notif.link || notif.metadata?.actionUrl || notif.metadata?.entityId || notif.entityId || notif.entityType || studentJournal || notif.type === "assignment") && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNotificationClick(notif);
              }}
              title={intent.actionLabel || "Open"}
              aria-label={intent.actionLabel || "Open notification"}
              className={`size-7.5 rounded-lg border border-zinc-200/70 dark:border-white/10 bg-zinc-100 text-zinc-500 dark:bg-zinc-800/80 dark:text-zinc-400 flex items-center justify-center transition-all duration-200 shadow-2xs cursor-pointer active:scale-95 ${intent.cardHoverBtn} ${intent.directHoverBtn}`}
            >
              <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // Render a Category Stack with clean, unified Apple-grade list architecture
  const renderCategoryStack = (stack: CategoryStack) => {
    const isUnstacked = unstackedCategoryId === stack.id;

    // If only 1 item, render directly as a single aligned card
    if (stack.items.length === 1) {
      return renderSingleCard(stack.items[0]);
    }

    // Multiple items - Collapsed Stack View: Refined minimal tactile card deck with crisp white paper layers
    if (!isUnstacked) {
      const topNotif = stack.items[0];
      const topJournal = !isTeacher ? findStudentJournalForNotif(topNotif) : null;
      const intent = getNotificationIntent(topNotif, isTeacher, !!topJournal);
      const relTime = formatRelativeTime(topNotif.createdAt);

      const cleanedMessage = (topNotif.message || "")
        .replace(/\s*\((LATE SUBMISSION|LATE)\)/gi, "")
        .replace(/\s*\[(LATE SUBMISSION|LATE)\]/gi, "")
        .trim();

      return (
        <div
          key={stack.id}
          className="relative isolate group cursor-pointer select-none transition-transform active:scale-[0.99] pb-2"
        >
          {/* Main Top Card */}
          <div
            onClick={() => handleNotificationClick(topNotif)}
            className={`w-full p-3 text-left rounded-xl border transition-all duration-200 flex items-start gap-3 relative z-30 shadow-[0_4px_14px_-2px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_6px_20px_rgba(0,0,0,0.65)] ${
              stack.unreadCount > 0
                ? "bg-violet-50/80 dark:bg-[#1a1824] border-violet-400/50 dark:border-violet-500/35 ring-1 ring-violet-500/20"
                : "bg-white dark:bg-[#18191e] border-zinc-200/90 dark:border-white/10 group-hover:border-zinc-300 dark:group-hover:border-white/20"
            }`}
          >
            {/* Squircle Icon */}
            <div
              className={`size-8 rounded-xl border ${intent.avatarBg} flex items-center justify-center shrink-0 mt-0.5 shadow-2xs dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-transform duration-200 group-hover:scale-105`}
            >
              {intent.icon}
            </div>

            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border shadow-2xs ${intent.badgeClass}`}
                  >
                    {intent.badgeText}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 flex items-center gap-1 shadow-2xs">
                    <Layers className="size-2.5" />
                    <span>{stack.items.length} stacked</span>
                  </span>
                  {stack.unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center gap-1 shadow-2xs">
                      <span className="size-1 rounded-full bg-rose-500 animate-pulse" />
                      <span>{stack.unreadCount} unread</span>
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold shrink-0">
                  {relTime}
                </span>
              </div>

              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-snug tracking-tight truncate">
                {topNotif.title}
              </span>
              {cleanedMessage && (
                <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed line-clamp-2 font-medium break-words">
                  {cleanedMessage}
                </p>
              )}
            </div>

            {/* Quick Actions & Trailing Affordance */}
            <div className="flex items-center gap-1 self-center shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNotificationClick(topNotif);
                }}
                title={intent.actionLabel || "Open"}
                aria-label={intent.actionLabel || "Open notification"}
                className={`size-7.5 rounded-lg border border-zinc-200/70 dark:border-white/10 bg-zinc-100 text-zinc-500 dark:bg-zinc-800/80 dark:text-zinc-400 flex items-center justify-center transition-all duration-200 shadow-2xs cursor-pointer active:scale-95 ${intent.cardHoverBtn} ${intent.directHoverBtn}`}
              >
                <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCategoryStack(stack.id);
                }}
                title="Expand stacked notifications"
                aria-label="Expand stacked notifications"
                className="size-7 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronDown className="size-4 transition-transform group-hover:translate-y-0.5" />
              </button>
            </div>
          </div>

          {/* Under-Card 1: Full-body stacked card with disciplined 3.5px peek & realistic shadow */}
          <div className="absolute inset-x-1.5 top-1 -bottom-1 rounded-xl bg-zinc-50/95 dark:bg-[#15161a] border border-zinc-200/90 dark:border-white/10 z-20 pointer-events-none shadow-[0_3px_10px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_14px_rgba(0,0,0,0.45)] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-bottom-1.5 group-hover:inset-x-2" />

          {/* Under-Card 2 (if > 2 items): 3rd full-body card layer with 7px peek */}
          {stack.items.length > 2 && (
            <div className="absolute inset-x-3 top-2 -bottom-2 rounded-xl bg-zinc-100/90 dark:bg-[#121316] border border-zinc-200/80 dark:border-white/[0.08] z-10 pointer-events-none shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-bottom-3 group-hover:inset-x-4" />
          )}
        </div>
      );
    }

    // Multiple items - Unstacked Expanded View: Contained mini-card with clean dividers
    return (
      <div key={stack.id} className="flex flex-col rounded-xl border border-zinc-200/90 dark:border-white/10 overflow-hidden bg-white dark:bg-[#18191e] shadow-2xs animate-in fade-in-50 duration-150">
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/80 dark:bg-white/[0.03]">
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border shadow-2xs ${stack.intent.badgeClass}`}
            >
              {stack.categoryName}
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground">
              {stack.items.length} notifications
            </span>
          </div>
          <button
            onClick={() => toggleCategoryStack(stack.id)}
            className="px-2 py-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-semibold rounded hover:bg-zinc-200/50 dark:hover:bg-zinc-800"
          >
            <span>Collapse</span>
            <ChevronUp className="size-3" />
          </button>
        </div>

        <div className="p-2.5 space-y-2 bg-zinc-50/40 dark:bg-black/15">
          {stack.items.map((item) => renderSingleCard(item))}
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      {/* Trigger Bell Button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open notifications"
        className={`relative size-8 rounded-full glass-btn-violet flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none ${
          bellPulsing ? "ring-2 ring-violet-500 scale-110 shadow-[0_0_15px_rgba(139,92,246,0.6)]" : ""
        }`}
      >
        <Bell className={`size-4 text-violet-600 dark:text-violet-400 ${bellPulsing ? "rotate-12 transition-transform" : ""}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Apple-style Floating Island Drawer Portal mounted directly at document.body */}
      {isOpen &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex justify-end p-2.5 sm:p-3.5 pointer-events-none">
            {/* Dimmed Backdrop */}
            <div
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-md transition-opacity duration-300 animate-in fade-in pointer-events-auto"
            />

            {/* Apple Floating Island Drawer Panel: Continuous squircle curvature, perimeter border & layered depth */}
            <div
              ref={dropdownRef}
              className="relative z-10 w-full sm:w-[480px] h-full max-h-[calc(100vh-20px)] sm:max-h-[calc(100vh-28px)] rounded-3xl bg-[#f8f9fa] dark:bg-[#0c0d0e] border border-zinc-200/90 dark:border-white/10 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3),_0_0_0_1px_rgba(255,255,255,0.4)] dark:shadow-[0_24px_70px_-15px_rgba(0,0,0,0.9),_0_0_0_1px_rgba(255,255,255,0.08)] flex flex-col select-none overflow-hidden animate-in slide-in-from-right duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-auto"
            >
              {/* Header with glassmorphism & elevated drop shadow */}
              <div className="shrink-0 px-5 py-4 border-b border-zinc-200/80 dark:border-white/10 bg-white/85 dark:bg-[#121316]/85 backdrop-blur-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)] flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="size-8.5 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-xs dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
                    <Sparkles className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                        Notifications
                      </span>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary/15 text-primary border border-primary/20 shadow-xs">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      {filterMode === "unread" ? `${unreadCount} unread` : `${notifications.length} total`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => readAllMutation.mutate()}
                      disabled={readAllMutation.isPending}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
                    >
                      <Check className="size-3.5" />
                      <span>Mark all read</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    aria-label="Close notifications"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* Apple Segmented Control Filter & Elevated Search */}
              <div className="shrink-0 px-4 pt-3.5 pb-3 border-b border-zinc-200/70 dark:border-white/[0.08] bg-white/50 dark:bg-[#121316]/50 backdrop-blur-md flex flex-col gap-2.5">
                <div className="flex p-1 rounded-xl bg-zinc-200/70 dark:bg-zinc-800/90 border border-zinc-300/50 dark:border-white/[0.06] shadow-inner gap-1">
                  <button
                    onClick={() => setFilterMode("all")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      filterMode === "all"
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold shadow-[0_2px_6px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(0,0,0,0.4)]"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>All</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterMode === "all" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold" : "text-muted-foreground"}`}>
                      {notifications.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setFilterMode("unread")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      filterMode === "unread"
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold shadow-[0_2px_6px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(0,0,0,0.4)]"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>Unread</span>
                    {unreadCount > 0 && (
                      <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                    )}
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterMode === "unread" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold" : "text-muted-foreground"}`}>
                      {unreadCount}
                    </span>
                  </button>
                </div>

                {/* Instant Search Bar with subtle depth */}
                <div className="relative flex items-center">
                  <Search className="absolute left-3 size-3.5 text-muted-foreground/60 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by experiment, student, or title..."
                    className="w-full pl-9 pr-7 py-2 text-xs rounded-xl bg-white dark:bg-zinc-800/90 border border-zinc-200/90 dark:border-white/10 placeholder:text-muted-foreground/60 text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 p-0.5 rounded hover:bg-muted text-muted-foreground cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Full-Height Smooth Scrollable Container with high-contrast canvas */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 notif-scrollbar">
                {isLoading ? (
                  <div className="p-10 flex items-center justify-center text-muted-foreground text-xs gap-2">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span>Syncing notifications...</span>
                  </div>
                ) : groupedNotifications.length === 0 ? (
                  searchQuery.trim() ? (
                    <div className="p-12 flex flex-col items-center justify-center text-muted-foreground/60 text-center gap-2">
                      <Search className="size-8 text-muted-foreground/40" />
                      <span className="text-xs font-semibold text-foreground">No matches found</span>
                      <p className="text-[11px] text-muted-foreground">
                        No notifications matched &ldquo;{searchQuery}&rdquo;
                      </p>
                      <button
                        onClick={() => setSearchQuery("")}
                        className="mt-2 px-3 py-1 text-xs font-semibold rounded-lg bg-zinc-200 dark:bg-zinc-800 text-foreground hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer shadow-xs"
                      >
                        Clear Search
                      </button>
                    </div>
                  ) : (
                    <div className="p-16 flex flex-col items-center justify-center text-muted-foreground/60 text-center gap-3">
                      <MailOpen className="size-9 text-muted-foreground/45" />
                      <span className="text-xs font-medium">
                        {filterMode === "unread" ? "No unread notifications" : "No notifications yet"}
                      </span>
                    </div>
                  )
                ) : (
                  groupedNotifications.map((expGroup) => {
                    const isExpExpanded = expandedExpId === expGroup.id;

                    return (
                      <div
                        key={expGroup.id}
                        className="flex flex-col rounded-2xl border border-zinc-200/90 dark:border-white/10 overflow-hidden bg-white dark:bg-[#141518] shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_24px_rgba(0,0,0,0.5)] transition-all"
                      >
                        {/* Tier 1: Experiment Accordion Header (Active Auto-Collapse) */}
                        <button
                          onClick={() => toggleExperiment(expGroup.id)}
                          className={`w-full px-4 py-3 flex items-center justify-between text-left transition-all cursor-pointer group active:scale-[0.99] ${
                            isExpExpanded
                              ? "bg-zinc-100/90 dark:bg-[#1a1b20] text-zinc-900 dark:text-zinc-100 font-bold border-b border-zinc-200/80 dark:border-white/10"
                              : "bg-white dark:bg-[#141518] hover:bg-zinc-50 dark:hover:bg-[#18191d] text-zinc-800 dark:text-zinc-200 font-semibold"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="size-6.5 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs">
                              <FlaskConical className="size-3.5" />
                            </div>
                            <span className="text-xs font-bold truncate">
                              {expGroup.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-zinc-200/80 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 shadow-xs">
                              {expGroup.items.length}
                            </span>
                            {expGroup.unreadCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1 shadow-xs">
                                <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                                <span>{expGroup.unreadCount} unread</span>
                              </span>
                            )}
                          </div>
                          <ChevronDown
                            className={`size-3.5 text-muted-foreground group-hover:text-foreground transition-transform duration-250 ease-out shrink-0 ${
                              isExpExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {/* Content inside this experiment with Emil Kowalski CSS Grid height transition */}
                        <div
                          className={`grid transition-[grid-template-rows] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                            isExpExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                          }`}
                        >
                          <div className="overflow-hidden">
                            {isTeacher ? (
                              <div className="divide-y divide-zinc-100 dark:divide-white/5 bg-white dark:bg-[#141518]">
                                {/* TEACHER VIEW: Students List as clean rows */}
                                {expGroup.students.map((studentGroup) => {
                                  const isStudentExpanded = expandedStudentId === studentGroup.id;
                                  const avatar = getStudentAvatarInfo(studentGroup.studentName);

                                  return (
                                    <div key={studentGroup.id} className="flex flex-col">
                                      {/* Tier 2 Student Header Row */}
                                      <button
                                        onClick={() => toggleStudent(studentGroup.id)}
                                        className={`w-full px-4 py-2.5 flex items-center justify-between group/st cursor-pointer transition-colors ${
                                          isStudentExpanded
                                            ? "bg-zinc-50 dark:bg-white/[0.03] text-zinc-900 dark:text-zinc-100 font-bold border-b border-zinc-100 dark:border-white/5"
                                            : "hover:bg-zinc-50/80 dark:hover:bg-white/[0.03] text-zinc-700 dark:text-zinc-300 font-semibold"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div
                                            className={`size-6 rounded-lg border ${avatar.border} ${avatar.bg} ${avatar.text} flex items-center justify-center font-bold text-[9px] shrink-0 tracking-tight shadow-xs`}
                                          >
                                            {avatar.initials}
                                          </div>
                                          <span className="text-xs truncate font-semibold">
                                            {studentGroup.studentName}
                                          </span>
                                          <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-zinc-200/80 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 shadow-xs">
                                            {studentGroup.items.length}
                                          </span>
                                          {studentGroup.unreadCount > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black bg-primary/15 text-primary flex items-center gap-1 shadow-xs">
                                              <span className="size-1 rounded-full bg-primary animate-pulse" />
                                              <span>{studentGroup.unreadCount}</span>
                                            </span>
                                          )}
                                        </div>
                                        <ChevronDown
                                          className={`size-3 text-muted-foreground group-hover/st:text-foreground transition-transform duration-200 shrink-0 ${
                                            isStudentExpanded ? "rotate-180" : ""
                                          }`}
                                        />
                                      </button>

                                      {/* Tier 3 Category Stacks inside Student: Elevated card tray */}
                                      <div
                                        className={`grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                                          isStudentExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                                        }`}
                                      >
                                        <div className="overflow-hidden">
                                          <div className="p-3 space-y-2.5 pb-4 bg-zinc-50/50 dark:bg-black/20">
                                            {studentGroup.categoryStacks.map((stack) =>
                                              renderCategoryStack(stack)
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              /* STUDENT VIEW: Direct Category Stacks under Experiment in elevated card tray */
                              <div className="p-3 space-y-2.5 pb-4 bg-zinc-50/50 dark:bg-black/20">
                                {expGroup.categoryStacks.map((stack) => renderCategoryStack(stack))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Footer Notice Bar */}
              <div className="shrink-0 px-5 py-3.5 bg-white/85 dark:bg-[#121316]/85 backdrop-blur-xl border-t border-zinc-200/80 dark:border-white/10 shadow-[0_-2px_10px_rgba(0,0,0,0.03)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.4)] flex items-center justify-between text-xs text-muted-foreground select-none">
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5 text-primary/80 shrink-0" />
                  <span>Read items auto-cleared in <strong className="text-foreground font-semibold">7 days</strong></span>
                </div>
                {unreadCount > 0 ? (
                  <span className="text-[11px] font-semibold text-rose-500">
                    {unreadCount} unread
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground/80">
                    All caught up
                  </span>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

