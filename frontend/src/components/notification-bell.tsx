"use client";

import { useState, useRef, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatRelativeTimeIST, formatDateTimeIST } from "@/lib/date";

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

function getNotificationIntent(notif: any) {
  const type = (notif.type || "").toLowerCase();
  const title = (notif.title || "").toLowerCase();
  const message = (notif.message || "").toLowerCase();
  const isLate = message.includes("late") || title.includes("late");

  if (type === "assignment" || title.includes("assignment")) {
    return {
      category: "Assignment",
      badgeText: "Assignment",
      icon: <BookOpen className="size-4 text-indigo-400 shrink-0" />,
      avatarBg: "bg-indigo-500/15 border-indigo-500/25",
      badgeClass: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    };
  }

  if (isLate) {
    return {
      category: "Late Submission",
      badgeText: "Late Submission",
      icon: <ClockAlert className="size-4 text-rose-400 shrink-0" />,
      avatarBg: "bg-rose-500/15 border-rose-500/25",
      badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30 font-extrabold",
    };
  }

  if (type === "submission" || title.includes("submission") || title.includes("handed in")) {
    return {
      category: "Submission",
      badgeText: "Submitted",
      icon: <FileCheck className="size-4 text-emerald-400 shrink-0" />,
      avatarBg: "bg-emerald-500/15 border-emerald-500/25",
      badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    };
  }

  if (type === "changes_requested" || title.includes("changes requested") || title.includes("revision")) {
    return {
      category: "Revision",
      badgeText: "Revision",
      icon: <FileEdit className="size-4 text-amber-400 shrink-0" />,
      avatarBg: "bg-amber-500/15 border-amber-500/25",
      badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30 font-extrabold",
    };
  }

  if (type === "approval" || title.includes("approved") || title.includes("graded")) {
    return {
      category: "Graded",
      badgeText: "Approved & Graded",
      icon: <GraduationCap className="size-4 text-teal-400 shrink-0" />,
      avatarBg: "bg-teal-500/15 border-teal-500/25",
      badgeClass: "bg-teal-500/15 text-teal-300 border-teal-500/30",
    };
  }

  if (type === "announcement" || title.includes("announcement")) {
    return {
      category: "Announcement",
      badgeText: "Announcement",
      icon: <Megaphone className="size-4 text-cyan-400 shrink-0" />,
      avatarBg: "bg-cyan-500/15 border-cyan-500/25",
      badgeClass: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    };
  }

  return {
    category: "System",
    badgeText: "Notification",
    icon: <Bell className="size-4 text-primary shrink-0" />,
    avatarBg: "bg-primary/15 border-primary/25",
    badgeClass: "bg-primary/15 text-primary border-primary/30",
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

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "unread">("all");

  // Tier 1: Single expanded experiment ID (Auto-collapses other experiments)
  const [expandedExpId, setExpandedExpId] = useState<string | null>(null);

  // Tier 2: Single expanded student ID (Teacher view, auto-collapses other students)
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // Tier 3: Single active unstacked category stack ID (Auto-collapses other category stacks)
  const [unstackedCategoryId, setUnstackedCategoryId] = useState<string | null>(null);


  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [bellPulsing, setBellPulsing] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch user profile to determine role (Teacher vs Student)
  const { data: user } = useQuery<any>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile"),
  });
  const isTeacher = user?.role === "teacher";

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
              queryClient.invalidateQueries({ queryKey: ["notifications"] });
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
    if (filterMode === "unread") {
      return notifications.filter((n: any) => !n.isRead);
    }
    return notifications;
  }, [notifications, filterMode]);

  // Helper to build category stacks for a collection of notifications
  const buildCategoryStacks = (prefix: string, items: any[]): CategoryStack[] => {
    const catMap = new Map<string, any[]>();
    items.forEach((item) => {
      const intent = getNotificationIntent(item);
      const catKey = intent.category;
      if (!catMap.has(catKey)) {
        catMap.set(catKey, []);
      }
      catMap.get(catKey)!.push(item);
    });

    return Array.from(catMap.entries()).map(([catKey, catItems]) => ({
      id: `${prefix}_${catKey}`.replace(/\s+/g, "_"),
      categoryName: catKey,
      intent: getNotificationIntent(catItems[0]),
      items: catItems,
      unreadCount: catItems.filter((i) => !i.isRead).length,
    }));
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
  }, [visibleNotifications, isTeacher]);

  // Auto-expand default: Open first experiment with unread items or first experiment
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
  }, [isOpen, groupedNotifications.length, isTeacher]);

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
    const targetUrl = notif.metadata?.actionUrl || notif.link;
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

  // Render an individual notification card (Samsung One UI capsule style)
  const renderSingleCard = (notif: any) => {
    const intent = getNotificationIntent(notif);
    const relTime = formatRelativeTime(notif.createdAt);
    const isLate =
      (notif.message || "").toLowerCase().includes("late") ||
      (notif.title || "").toLowerCase().includes("late");

    const cleanedMessage = (notif.message || "")
      .replace(/\s*\((LATE SUBMISSION|LATE)\)/gi, "")
      .replace(/\s*\[(LATE SUBMISSION|LATE)\]/gi, "")
      .trim();

    return (
      <button
        key={notif.id}
        onClick={() => handleNotificationClick(notif)}
        className={`w-full p-3 text-left transition-all flex items-start gap-3 rounded-2xl border cursor-pointer group relative shadow-2xs ${
          !notif.isRead
            ? "bg-zinc-100 dark:bg-zinc-800 border-primary/40 ring-1 ring-primary/20 shadow-xs hover:border-primary"
            : "bg-zinc-100/70 dark:bg-zinc-800/60 border-border/60 dark:border-zinc-700/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-border"
        }`}
      >
        {/* Rounded Squircle App/Category Icon */}
        <div
          className={`size-8 rounded-xl border ${intent.avatarBg} flex items-center justify-center shrink-0 mt-0.5 shadow-xs transition-transform group-hover:scale-105`}
        >
          {intent.icon}
        </div>

        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${intent.badgeClass}`}
              >
                {intent.badgeText}
              </span>
              {!notif.isRead && (
                <span className="px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider bg-primary/15 text-primary border border-primary/25 flex items-center gap-1">
                  <span className="size-1 rounded-full bg-primary animate-pulse" />
                  <span>UNREAD</span>
                </span>
              )}
              {isLate && (
                <span className="px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                  LATE
                </span>
              )}
            </div>
            <span
              className="text-[10px] text-zinc-400 dark:text-zinc-400 font-semibold shrink-0"
              title={formatDateTimeIST(notif.createdAt)}
            >
              {relTime}
            </span>
          </div>

          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-snug tracking-tight">
            {notif.title}
          </span>

          {cleanedMessage && (
            <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed line-clamp-1 font-medium">
              {cleanedMessage}
            </p>
          )}
        </div>

        {(notif.link || notif.metadata?.actionUrl) && (
          <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 self-center" />
        )}
      </button>
    );
  };

  // Render a Category Stack with authentic Samsung One UI card deck behavior
  const renderCategoryStack = (stack: CategoryStack) => {
    const isUnstacked = unstackedCategoryId === stack.id;


    // If only 1 item, render directly as a single card
    if (stack.items.length === 1) {
      return renderSingleCard(stack.items[0]);
    }

    // Multiple items: Samsung One UI Stacked Deck
    if (!isUnstacked) {
      const topNotif = stack.items[0];
      const intent = getNotificationIntent(topNotif);
      const relTime = formatRelativeTime(topNotif.createdAt);
      const isLate =
        (topNotif.message || "").toLowerCase().includes("late") ||
        (topNotif.title || "").toLowerCase().includes("late");

      const cleanedMessage = (topNotif.message || "")
        .replace(/\s*\((LATE SUBMISSION|LATE)\)/gi, "")
        .replace(/\s*\[(LATE SUBMISSION|LATE)\]/gi, "")
        .trim();

      return (
        <div
          key={stack.id}
          onClick={() => toggleCategoryStack(stack.id)}
          className="relative group cursor-pointer mt-1 mb-2 select-none transition-transform active:scale-[0.99]"
        >
          {/* Top Physical Card */}
          <div className="p-3 text-left bg-zinc-100 dark:bg-zinc-800 border border-border/80 dark:border-zinc-700/80 rounded-2xl shadow-xs flex items-start gap-3 relative z-10 transition-all hover:border-zinc-400 dark:hover:border-zinc-600">
            <div
              className={`size-8 rounded-xl border ${intent.avatarBg} flex items-center justify-center shrink-0 mt-0.5 shadow-xs`}
            >
              {intent.icon}
            </div>

            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${intent.badgeClass}`}
                  >
                    {intent.badgeText}
                  </span>
                  {/* Samsung One UI Stack Indicator Badge */}
                  <span className="px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-border/50 dark:border-zinc-600/50 flex items-center gap-1">
                    <Layers className="size-2.5" />
                    <span>{stack.items.length} stacked</span>
                  </span>
                  {stack.unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black bg-primary/15 text-primary border border-primary/25 flex items-center gap-1">
                      <span className="size-1 rounded-full bg-primary animate-pulse" />
                      <span>{stack.unreadCount} unread</span>
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-400 font-semibold shrink-0">
                  {relTime}
                </span>
              </div>

              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-snug tracking-tight truncate">
                {topNotif.title}
              </span>
              {cleanedMessage && (
                <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed line-clamp-1 font-medium">
                  {cleanedMessage}
                </p>
              )}
            </div>
          </div>

          {/* Samsung One UI Under-Card 1 (Full card shape sitting behind, peeking 3.5px below) */}
          <div className="absolute inset-x-2 -bottom-1 h-full rounded-2xl bg-zinc-200 dark:bg-zinc-800/80 border border-border/50 dark:border-zinc-700/50 pointer-events-none -z-10 shadow-2xs" />

          {/* Samsung One UI Under-Card 2 (If > 2 items, peeking 6px below) */}
          {stack.items.length > 2 && (
            <div className="absolute inset-x-4 -bottom-2 h-full rounded-2xl bg-zinc-300 dark:bg-zinc-800/50 border border-border/40 dark:border-zinc-700/30 pointer-events-none -z-20 shadow-2xs" />
          )}
        </div>
      );
    }

    // Unstacked Expanded View (Matching One UI Screenshot 2: Clean header + individual cards)
    return (
      <div key={stack.id} className="flex flex-col gap-2 my-1 animate-in slide-in-from-top-1 duration-150">
        {/* Clean One UI Section Header with Collapse Action (NO ugly gray outer container!) */}
        <div className="flex items-center justify-between px-2 pt-1 pb-0.5">
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${stack.intent.badgeClass}`}
            >
              {stack.categoryName}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground">
              ({stack.items.length} notifications)
            </span>
          </div>
          <button
            onClick={() => toggleCategoryStack(stack.id)}
            className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-semibold"
          >
            <span>Collapse</span>
            <ChevronUp className="size-3.5" />
          </button>
        </div>

        {/* Individual Cards neatly separated */}
        <div className="flex flex-col gap-2">
          {stack.items.map((item) => renderSingleCard(item))}
        </div>
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Bell Button */}
      <button
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

      {/* Floating Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-[390px] sm:w-[430px] rounded-3xl bg-white dark:bg-zinc-900 border border-border shadow-2xl z-[100] overflow-hidden flex flex-col transform origin-top-right transition-all select-none">
          {/* Header */}
          <div className="shrink-0 px-4 py-3.5 border-b border-border bg-zinc-50/90 dark:bg-zinc-800/90 backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-primary/15 text-primary border border-primary/20">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => readAllMutation.mutate()}
                disabled={readAllMutation.isPending}
                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Check className="size-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Filter Tabs: All vs Unread */}
          <div className="shrink-0 flex items-center gap-1 px-3 pt-2.5 pb-1.5 border-b border-border/40 bg-zinc-50/40 dark:bg-zinc-900/50">
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                filterMode === "all"
                  ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilterMode("unread")}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === "unread"
                  ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
              )}
              <span>({unreadCount})</span>
            </button>
          </div>

          {/* Ultra-Compact 4px Smooth Scrollable Container */}
          <div
            onWheel={(e) => e.stopPropagation()}
            className="w-full max-h-[360px] overflow-y-auto px-3 pt-3 pb-4 space-y-2.5 notif-scrollbar"
            style={{
              maxHeight: "350px",
              overflowY: "auto",
              overscrollBehavior: "contain",
            }}
          >
            {isLoading ? (
              <div className="p-10 flex items-center justify-center text-muted-foreground text-xs gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>Syncing notifications...</span>
              </div>
            ) : groupedNotifications.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center text-muted-foreground/60 text-center gap-2">
                <MailOpen className="size-7 text-muted-foreground/45" />
                <span className="text-xs font-medium">
                  {filterMode === "unread" ? "No unread notifications" : "No notifications yet"}
                </span>
              </div>
            ) : (
              groupedNotifications.map((expGroup) => {
                const isExpExpanded = expandedExpId === expGroup.id;

                return (
                  <div
                    key={expGroup.id}
                    className="flex flex-col rounded-2xl border border-border/70 overflow-hidden bg-zinc-50/50 dark:bg-zinc-800/30 transition-all"
                  >
                    {/* Tier 1: Experiment Accordion Header (Active Auto-Collapse) */}
                    <button
                      onClick={() => toggleExperiment(expGroup.id)}
                      className={`w-full px-3.5 py-2.5 flex items-center justify-between text-left transition-colors cursor-pointer group ${
                        isExpExpanded
                          ? "bg-zinc-100/90 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100"
                          : "hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70 text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="size-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <FlaskConical className="size-3.5" />
                        </div>
                        <span className="text-xs font-bold truncate">
                          {expGroup.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200">
                          {expGroup.items.length}
                        </span>
                        {expGroup.unreadCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            {expGroup.unreadCount} unread
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={`size-4 text-muted-foreground group-hover:text-foreground transition-transform duration-200 shrink-0 ${
                          isExpExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Content inside this experiment */}
                    {isExpExpanded && (
                      <div className="px-2.5 pb-2.5 pt-1.5 flex flex-col gap-2.5 border-t border-border/40 animate-in slide-in-from-top-1 duration-150">
                        {isTeacher ? (
                          /* TEACHER VIEW: Tier 2 Students List */
                          expGroup.students.map((studentGroup) => {
                            const isStudentExpanded = expandedStudentId === studentGroup.id;

                            return (
                              <div key={studentGroup.id} className="flex flex-col transition-all">
                                {/* Tier 2 Student Header Button (Auto-collapses other students) */}
                                <button
                                  onClick={() => toggleStudent(studentGroup.id)}
                                  className={`w-full px-3 py-2 flex items-center justify-between group/st cursor-pointer rounded-xl border transition-all ${
                                    isStudentExpanded
                                      ? "bg-white dark:bg-zinc-800 border-border text-foreground font-bold shadow-xs"
                                      : "bg-white/40 dark:bg-zinc-800/40 border-border/40 text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-zinc-800"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="size-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                      <User className="size-3" />
                                    </div>
                                    <span className="text-xs font-bold truncate">
                                      {studentGroup.studentName}
                                    </span>
                                    <span className="px-1.5 py-0.2 rounded-full text-[8px] font-extrabold bg-muted text-muted-foreground border border-border/40">
                                      {studentGroup.items.length}
                                    </span>
                                    {studentGroup.unreadCount > 0 && (
                                      <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black bg-primary/15 text-primary">
                                        {studentGroup.unreadCount} new
                                      </span>
                                    )}
                                  </div>
                                  <ChevronDown
                                    className={`size-3 text-muted-foreground group-hover/st:text-foreground transition-transform duration-200 shrink-0 ${
                                      isStudentExpanded ? "rotate-180" : ""
                                    }`}
                                  />
                                </button>

                                {/* Tier 3 Category Stacks inside Student */}
                                {isStudentExpanded && (
                                  <div className="mt-2 pl-2.5 flex flex-col gap-2.5 border-l-2 border-emerald-500/30 animate-in slide-in-from-top-1 duration-150">
                                    {studentGroup.categoryStacks.map((stack) =>
                                      renderCategoryStack(stack)
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          /* STUDENT VIEW: Direct Category Stacks under Experiment */
                          expGroup.categoryStacks.map((stack) => renderCategoryStack(stack))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Footer Notice Bar */}
          <div className="shrink-0 px-4 py-2.5 bg-zinc-50/90 dark:bg-zinc-850/90 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground select-none">
            <div className="flex items-center gap-1.5">
              <Clock className="size-3 text-primary/80 shrink-0" />
              <span>Read items auto-cleared in <strong className="text-foreground font-semibold">7 days</strong></span>
            </div>
            {unreadCount > 0 && (
              <span className="text-[10px] font-medium text-muted-foreground/80">
                {unreadCount} unread
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

