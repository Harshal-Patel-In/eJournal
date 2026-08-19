"use client";

import { useState, useRef, useEffect } from "react";
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
  ChevronRight,
  ChevronDown,
  Sparkles,
  Layers,
  FlaskConical,
  User,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface CategorySubGroup {
  id: string;
  categoryName: string;
  intent: any;
  items: any[];
  unreadCount: number;
}

interface StudentSubGroup {
  id: string;
  studentName: string;
  items: any[];
  categories: CategorySubGroup[];
  unreadCount: number;
}

interface ExperimentGroup {
  id: string;
  experimentName: string;
  items: any[];
  students: StudentSubGroup[];
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
      icon: <BookOpen className="size-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />,
      avatarBg: "bg-indigo-500/10 border-indigo-500/20",
      badgeClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    };
  }

  if (isLate) {
    return {
      category: "Late Submission",
      badgeText: "Late Submission",
      icon: <ClockAlert className="size-3.5 text-rose-500 dark:text-rose-400 shrink-0" />,
      avatarBg: "bg-rose-500/10 border-rose-500/20",
      badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-extrabold",
    };
  }

  if (type === "submission" || title.includes("submission") || title.includes("handed in")) {
    return {
      category: "Submission",
      badgeText: "Submitted",
      icon: <FileCheck className="size-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />,
      avatarBg: "bg-emerald-500/10 border-emerald-500/20",
      badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    };
  }

  if (type === "changes_requested" || title.includes("changes requested") || title.includes("revision")) {
    return {
      category: "Revision",
      badgeText: "Revision",
      icon: <FileEdit className="size-3.5 text-amber-500 dark:text-amber-400 shrink-0" />,
      avatarBg: "bg-amber-500/10 border-amber-500/20",
      badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-extrabold",
    };
  }

  if (type === "approval" || title.includes("approved") || title.includes("graded")) {
    return {
      category: "Graded",
      badgeText: "Approved & Graded",
      icon: <GraduationCap className="size-3.5 text-teal-500 dark:text-teal-400 shrink-0" />,
      avatarBg: "bg-teal-500/10 border-teal-500/20",
      badgeClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    };
  }

  if (type === "announcement" || title.includes("announcement")) {
    return {
      category: "Announcement",
      badgeText: "Announcement",
      icon: <Megaphone className="size-3.5 text-cyan-500 dark:text-cyan-400 shrink-0" />,
      avatarBg: "bg-cyan-500/10 border-cyan-500/20",
      badgeClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    };
  }

  return {
    category: "System",
    badgeText: "Notification",
    icon: <Bell className="size-3.5 text-primary shrink-0" />,
    avatarBg: "bg-primary/10 border-primary/20",
    badgeClass: "bg-primary/15 text-primary border-primary/30",
  };
}

function getExperimentName(notif: any): string {
  const text = `${notif.title || ""} ${notif.message || ""}`;
  const match = text.match(/(Experiment\s*#?\d+([^\s\.\,\(\)]*)|Experiment\s*[\w\d\-]+|Lab\s*#?\d+|Practical\s*#?\d+)/i);
  if (match && match[0]) {
    return match[0].trim();
  }
  return "General Activity";
}

function getStudentName(notif: any): string {
  const text = `${notif.title || ""} ${notif.message || ""}`;
  const match = text.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(has|submitted|handed|requested|commented|created)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  const fallbackMatch = text.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)/);
  if (fallbackMatch && fallbackMatch[1]) {
    return fallbackMatch[1].trim();
  }
  return "Classroom User";
}

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedExpId, setExpandedExpId] = useState<string | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

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

  // Real-Time WebSocket Notification Streaming
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;
    let isMounted = true;

    function connect() {
      if (typeof window === "undefined" || !isMounted) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = process.env.NEXT_PUBLIC_WS_HOST || "localhost:8000";
      const wsUrl = `${protocol}//${host}/api/v1/notifications/ws`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "NEW_NOTIFICATION") {
              // 1. Immediately invalidate TanStack cache for zero-latency UI update
              queryClient.invalidateQueries({ queryKey: ["notifications"] });

              // 2. Trigger bell animation pulse
              setBellPulsing(true);
              setTimeout(() => setBellPulsing(false), 2500);

              // 3. Play gentle harmonic chime
              try {
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioCtx) {
                  const ctx = new AudioCtx();
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  osc.type = "sine";
                  osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
                  osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
                  gain.gain.setValueAtTime(0.06, ctx.currentTime);
                  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  osc.start();
                  osc.stop(ctx.currentTime + 0.35);
                }
              } catch (audioErr) {
                // Audio autoplay restriction ignored safely
              }
            }
          } catch (e) {
            // ignore non-json keepalive messages
          }
        };

        ws.onclose = () => {
          if (isMounted) {
            reconnectTimer = setTimeout(connect, 3000);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch (err) {
        if (isMounted) {
          reconnectTimer = setTimeout(connect, 5000);
        }
      }
    }

    connect();

    const pingTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, 25000);

    return () => {
      isMounted = false;
      clearInterval(pingTimer);
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

  const notifications = Array.isArray(response) ? response : (response?.data || []);
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  // Build 3-Tier Tree: Experiment (Tier 1) -> Student (Tier 2) -> Category (Tier 3)
  const experimentMap = new Map<string, any[]>();
  notifications.forEach((notif: any) => {
    const expName = getExperimentName(notif);
    if (!experimentMap.has(expName)) {
      experimentMap.set(expName, []);
    }
    experimentMap.get(expName)!.push(notif);
  });

  const experimentGroups: ExperimentGroup[] = Array.from(experimentMap.entries()).map(([expName, expItems]) => {
    const studentMap = new Map<string, any[]>();
    expItems.forEach((item: any) => {
      const sName = getStudentName(item);
      if (!studentMap.has(sName)) {
        studentMap.set(sName, []);
      }
      studentMap.get(sName)!.push(item);
    });

    const students: StudentSubGroup[] = Array.from(studentMap.entries()).map(([sName, sItems]) => {
      const catMap = new Map<string, any[]>();
      sItems.forEach((item: any) => {
        const cat = getNotificationIntent(item).category;
        if (!catMap.has(cat)) {
          catMap.set(cat, []);
        }
        catMap.get(cat)!.push(item);
      });

      const categories: CategorySubGroup[] = Array.from(catMap.entries()).map(([cName, cItems]) => ({
        id: `${expName}_${sName}_${cName}`.replace(/\s+/g, "_"),
        categoryName: cName,
        intent: getNotificationIntent(cItems[0]),
        items: cItems,
        unreadCount: cItems.filter((i) => !i.isRead).length,
      }));

      return {
        id: `${expName}_${sName}`.replace(/\s+/g, "_"),
        studentName: sName,
        items: sItems,
        categories,
        unreadCount: sItems.filter((i) => !i.isRead).length,
      };
    });

    return {
      id: `exp_${expName}`.replace(/\s+/g, "_"),
      experimentName: expName,
      items: expItems,
      students,
      unreadCount: expItems.filter((i) => !i.isRead).length,
    };
  });

  // Auto-expand Tier 1, Tier 2, and Tier 3 on initial load
  useEffect(() => {
    if (expandedExpId === null && experimentGroups.length > 0) {
      const firstExp = experimentGroups[0];
      setExpandedExpId(firstExp.id);
      if (firstExp.students.length > 0) {
        const firstStudent = firstExp.students[0];
        setExpandedStudentId(firstStudent.id);
        if (firstStudent.categories.length > 0) {
          setExpandedCategoryId(firstStudent.categories[0].id);
        }
      }
    }
  }, [experimentGroups.length]);

  // 2. Mark single notification as read mutation
  const readMutation = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // 3. Mark all as read mutation
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

  const toggleExperiment = (expId: string) => {
    if (expandedExpId === expId) {
      setExpandedExpId(null);
      setExpandedStudentId(null);
      setExpandedCategoryId(null);
    } else {
      setExpandedExpId(expId);
      const exp = experimentGroups.find((e) => e.id === expId);
      if (exp && exp.students.length > 0) {
        const firstS = exp.students[0];
        setExpandedStudentId(firstS.id);
        if (firstS.categories.length > 0) {
          setExpandedCategoryId(firstS.categories[0].id);
        } else {
          setExpandedCategoryId(null);
        }
      } else {
        setExpandedStudentId(null);
        setExpandedCategoryId(null);
      }
    }
  };

  const toggleStudent = (studentId: string) => {
    if (expandedStudentId === studentId) {
      setExpandedStudentId(null);
      setExpandedCategoryId(null);
    } else {
      setExpandedStudentId(studentId);
      const exp = experimentGroups.find((e) => e.id === expandedExpId);
      const s = exp?.students.find((st) => st.id === studentId);
      if (s && s.categories.length > 0) {
        setExpandedCategoryId(s.categories[0].id);
      } else {
        setExpandedCategoryId(null);
      }
    }
  };

  const toggleCategory = (catId: string) => {
    setExpandedCategoryId((prev) => (prev === catId ? null : catId));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
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

      {/* Floating Popover Dropdown (Opaque Solid Surface to Prevent Page Bleed) */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-[420px] rounded-3xl bg-slate-50 dark:bg-zinc-900 border border-border/80 shadow-2xl z-[100] overflow-hidden transform origin-top-right transition-all select-none">
          {/* Header */}
          <div className="p-4 border-b border-border/60 flex items-center justify-between bg-white dark:bg-zinc-850">
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-primary/70" />
              <span className="text-xs font-bold text-foreground tracking-tight">Notifications</span>
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
                className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Check className="size-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List Content with 3-Tier Hierarchy: Experiment -> Student -> Category */}
          <div className="max-h-[440px] overflow-y-auto p-3 flex flex-col gap-3">
            {isLoading ? (
              <div className="p-8 flex items-center justify-center text-muted-foreground text-xs gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>Syncing notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 flex flex-col items-center justify-center text-muted-foreground/60 text-center gap-2">
                <MailOpen className="size-6 text-muted-foreground/45" />
                <span className="text-xs font-medium">No notifications yet</span>
              </div>
            ) : (
              experimentGroups.map((expGroup) => {
                const isExpExpanded = expandedExpId === expGroup.id;

                return (
                  <div key={expGroup.id} className="flex flex-col transition-all duration-200">
                    {/* TIER 1: Experiment / Practical Header Button */}
                    <button
                      onClick={() => toggleExperiment(expGroup.id)}
                      className={`w-full p-2.5 flex items-center justify-between group cursor-pointer rounded-2xl border transition-all ${
                        isExpExpanded
                          ? "bg-white dark:bg-zinc-800 border-border shadow-xs"
                          : "bg-white/60 dark:bg-zinc-850/50 border-border/50 hover:bg-white dark:hover:bg-zinc-800"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                          <FlaskConical className="size-4 text-indigo-500" />
                        </div>
                        <span className="text-xs font-extrabold text-foreground tracking-tight">
                          {expGroup.experimentName}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-muted text-muted-foreground border border-border/50">
                          {expGroup.items.length} items
                        </span>
                        {expGroup.unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-primary/15 text-primary border border-primary/20">
                            {expGroup.unreadCount} new
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={`size-4 text-muted-foreground group-hover:text-foreground transition-transform duration-200 ${
                          isExpExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* TIER 2: Student Sub-Groups (Expanded Tier 1) */}
                    {isExpExpanded && (
                      <div className="mt-2 pl-3 flex flex-col gap-2.5 border-l-2 border-indigo-500/30 animate-in slide-in-from-top-1 duration-150">
                        {expGroup.students.map((studentGroup) => {
                          const isStudentExpanded = expandedStudentId === studentGroup.id;

                          return (
                            <div key={studentGroup.id} className="flex flex-col transition-all duration-200">
                              {/* TIER 2 Header Button (Student) */}
                              <button
                                onClick={() => toggleStudent(studentGroup.id)}
                                className={`w-full py-1.5 px-2.5 flex items-center justify-between group/st cursor-pointer rounded-xl border transition-all ${
                                  isStudentExpanded
                                    ? "bg-white dark:bg-zinc-800 border-primary/30 shadow-2xs text-primary font-bold"
                                    : "bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <User className="size-3.5 text-primary/70 shrink-0" />
                                  <span className="text-[11px] font-extrabold text-foreground truncate max-w-[180px]">
                                    {studentGroup.studentName}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded-full text-[8px] font-extrabold bg-muted text-muted-foreground border border-border/40">
                                    {studentGroup.items.length} items
                                  </span>
                                  {studentGroup.unreadCount > 0 && (
                                    <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black bg-primary/15 text-primary">
                                      {studentGroup.unreadCount} unread
                                    </span>
                                  )}
                                </div>
                                <ChevronDown
                                  className={`size-3.5 text-muted-foreground group-hover/st:text-foreground transition-transform duration-200 ${
                                    isStudentExpanded ? "rotate-180" : ""
                                  }`}
                                />
                              </button>

                              {/* TIER 3: Category Sub-Stacks (Expanded Tier 2) */}
                              {isStudentExpanded && (
                                <div className="mt-2 pl-3 flex flex-col gap-2 border-l-2 border-emerald-500/30 animate-in slide-in-from-top-1 duration-150">
                                  {studentGroup.categories.map((catGroup) => {
                                    const isCatExpanded = expandedCategoryId === catGroup.id;
                                    const latestNotif = catGroup.items[0];
                                    const latestIntent = getNotificationIntent(latestNotif);
                                    const latestRelTime = formatRelativeTime(latestNotif.createdAt);

                                    return (
                                      <div key={catGroup.id} className="flex flex-col transition-all duration-200">
                                        {/* TIER 3 Header Button (Category) */}
                                        <button
                                          onClick={() => toggleCategory(catGroup.id)}
                                          className={`w-full py-1 px-2 flex items-center justify-between group/cat cursor-pointer rounded-lg transition-colors ${
                                            isCatExpanded
                                              ? "bg-muted/60 text-foreground font-bold"
                                              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                                          }`}
                                        >
                                          <div className="flex items-center gap-1.5">
                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider border ${catGroup.intent.badgeClass}`}>
                                              {catGroup.categoryName}
                                            </span>
                                            <span className="px-1.5 py-0.2 rounded-full text-[8px] font-extrabold bg-muted text-muted-foreground border border-border/40">
                                              {catGroup.items.length}
                                            </span>
                                          </div>
                                          <ChevronDown
                                            className={`size-3 text-muted-foreground group-hover/cat:text-foreground transition-transform duration-200 ${
                                              isCatExpanded ? "rotate-180" : ""
                                            }`}
                                          />
                                        </button>

                                        {/* Individual Cards vs Collapsed Stack Layers */}
                                        {isCatExpanded ? (
                                          /* Unstacked Individual Cards */
                                          <div className="mt-1.5 pl-1 flex flex-col gap-2 animate-in slide-in-from-top-1 duration-150">
                                            {catGroup.items.map((notif: any) => {
                                              const intent = getNotificationIntent(notif);
                                              const relTime = formatRelativeTime(notif.createdAt);
                                              const isLate = (notif.message || "").toLowerCase().includes("late") || (notif.title || "").toLowerCase().includes("late");

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
                                                      ? "bg-white dark:bg-zinc-800 border-primary/30 ring-1 ring-primary/20 hover:border-primary/50"
                                                      : "bg-white/60 dark:bg-zinc-850/50 border-border/60 hover:bg-white dark:hover:bg-zinc-800 hover:border-border opacity-85 hover:opacity-100"
                                                  }`}
                                                >
                                                  {/* Category Icon Avatar */}
                                                  <div className={`size-8 rounded-2xl border ${intent.avatarBg} flex items-center justify-center shrink-0 mt-0.5 shadow-xs transition-transform group-hover:scale-105`}>
                                                    {intent.icon}
                                                  </div>

                                                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                    {/* Top Row: Category Badge + Static Glass Status Pills (No Blinking Dots!) */}
                                                    <div className="flex items-center justify-between gap-2">
                                                      <div className="flex items-center gap-1.5">
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${intent.badgeClass}`}>
                                                          {intent.badgeText}
                                                        </span>
                                                        {/* Static UNREAD Glass Pill Badge */}
                                                        {!notif.isRead && (
                                                          <span className="px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider bg-primary/15 text-primary border border-primary/25">
                                                            UNREAD
                                                          </span>
                                                        )}
                                                        {/* Static LATE Glass Pill Badge */}
                                                        {isLate && (
                                                          <span className="px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                                                            LATE
                                                          </span>
                                                        )}
                                                      </div>
                                                      <span className="text-[10px] text-muted-foreground/70 font-semibold shrink-0">
                                                        {relTime}
                                                      </span>
                                                    </div>

                                                    {/* Title & Cleaned Message */}
                                                    <span className="text-xs font-bold text-foreground leading-snug tracking-tight truncate">
                                                      {notif.title}
                                                    </span>
                                                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 font-medium">
                                                      {cleanedMessage}
                                                    </p>
                                                  </div>

                                                  {/* Navigation Arrow */}
                                                  {notif.link && (
                                                    <ChevronRight className="size-3.5 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 self-center" />
                                                  )}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          /* Collapsed Stack View for Tier 3 Category Sub-Stack */
                                          <div className="mt-1 relative group cursor-pointer" onClick={() => toggleCategory(catGroup.id)}>
                                            <div className="p-3 text-left bg-white dark:bg-zinc-800 border border-border/80 rounded-2xl shadow-xs flex items-start gap-3 relative z-10 transition-transform group-hover:scale-[1.01]">
                                              <div className={`size-8 rounded-2xl border ${latestIntent.avatarBg} flex items-center justify-center shrink-0 mt-0.5 shadow-xs`}>
                                                {latestIntent.icon}
                                              </div>

                                              <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${latestIntent.badgeClass}`}>
                                                      {latestIntent.badgeText}
                                                    </span>
                                                    <span className="px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider bg-muted text-muted-foreground border border-border/50 flex items-center gap-1">
                                                      <Layers className="size-2.5" />
                                                      <span>{catGroup.items.length} stacked</span>
                                                    </span>
                                                  </div>
                                                  <span className="text-[10px] text-muted-foreground/70 font-semibold shrink-0">
                                                    {latestRelTime}
                                                  </span>
                                                </div>

                                                <span className="text-xs font-bold text-foreground leading-snug tracking-tight truncate">
                                                  {latestNotif.title}
                                                </span>
                                                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-1 font-medium">
                                                  {(latestNotif.message || "").replace(/\s*\((LATE SUBMISSION|LATE)\)/gi, "").trim()}
                                                </p>
                                              </div>
                                            </div>

                                            {/* Stacked Paper Layer Visual */}
                                            {catGroup.items.length > 1 && (
                                              <div className="absolute -bottom-1 left-2 right-2 h-3 rounded-2xl bg-muted/60 dark:bg-zinc-850 border border-border/40 pointer-events-none z-0" />
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
