/**
 * Student and Teacher Dashboard View.
 *
 * Grounded in Apple HIG, Impeccable UI standards, and Emil Kowalski motion design.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import {
  ArrowRight,
  BookOpen,
  Building2,
  GraduationCap,
  Plus,
  Sparkles,
  UserPlus,
  User,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  Award,
  ShieldAlert,
  Copy,
  Check,
  Users,
  FlaskConical,
  LogOut,
} from "lucide-react";

import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const CLASSROOM_THEMES = [
  {
    // Muted Slate Sky
    indicator: "bg-sky-500/70 dark:bg-sky-400/60",
    badge:
      "bg-sky-500/[0.06] text-sky-800 dark:text-sky-300 border-sky-500/20 font-semibold",
    hoverBorder: "hover:border-sky-500/35",
    hoverTitle: "group-hover:text-primary",
  },
  {
    // Muted Sage
    indicator: "bg-emerald-600/70 dark:bg-emerald-400/60",
    badge:
      "bg-emerald-600/[0.06] text-emerald-800 dark:text-emerald-300 border-emerald-600/20 font-semibold",
    hoverBorder: "hover:border-emerald-600/35",
    hoverTitle: "group-hover:text-primary",
  },
  {
    // Muted Slate Violet
    indicator: "bg-violet-600/70 dark:bg-violet-400/60",
    badge:
      "bg-violet-600/[0.06] text-violet-800 dark:text-violet-300 border-violet-600/20 font-semibold",
    hoverBorder: "hover:border-violet-600/35",
    hoverTitle: "group-hover:text-primary",
  },
  {
    // Muted Warm Amber / Ochre
    indicator: "bg-amber-600/70 dark:bg-amber-400/60",
    badge:
      "bg-amber-600/[0.06] text-amber-800 dark:text-amber-300 border-amber-600/20 font-semibold",
    hoverBorder: "hover:border-amber-600/35",
    hoverTitle: "group-hover:text-primary",
  },
  {
    // Muted Terracotta / Dusty Rose (NOT hot pink)
    indicator: "bg-rose-600/70 dark:bg-rose-400/60",
    badge:
      "bg-rose-600/[0.06] text-rose-800 dark:text-rose-300 border-rose-600/20 font-semibold",
    hoverBorder: "hover:border-rose-600/35",
    hoverTitle: "group-hover:text-primary",
  },
];

function getClassroomTheme(id: string, index: number) {
  if (!id) return CLASSROOM_THEMES[index % CLASSROOM_THEMES.length];
  const charSum = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CLASSROOM_THEMES[charSum % CLASSROOM_THEMES.length];
}

interface ClassroomTelemetry {
  studentCount: number;
  assignmentCount: number;
  pendingReviewCount: number;
}

interface TeacherAnalytics {
  totalClassrooms: number;
  totalStudents: number;
  totalAssignments: number;
  pendingSubmissions: number;
  approvedSubmissions: number;
  classroomsStats: Record<string, ClassroomTelemetry>;
}

const joinClassroomSchema = zod.object({
  joinCode: zod.string().min(4, "Invalid join code"),
});

const createClassroomSchema = zod.object({
  name: zod.string().min(2, "Name must be at least 2 characters"),
  subject: zod.string().min(2, "Subject must be at least 2 characters"),
  semester: zod.string().min(1, "Semester is required"),
  division: zod.string().min(1, "Division is required"),
  department: zod.string().min(2, "Department must be at least 2 characters"),
});

type JoinClassroomFields = zod.infer<typeof joinClassroomSchema>;
type CreateClassroomFields = zod.infer<typeof createClassroomSchema>;

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // 1. Fetch user profile
  const { data: user, isLoading: userLoading } = useQuery<any>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile"),
  });

  // 2. Fetch classrooms list
  const { data: classrooms, isLoading: classroomsLoading } = useQuery<any[]>({
    queryKey: ["classrooms"],
    queryFn: () => api.get("/classrooms"),
    enabled: !!user,
  });

  // 2b. Fetch student academic analytics if student
  const { data: analytics } = useQuery<any>({
    queryKey: ["student-analytics"],
    queryFn: () => api.get("/analytics/student"),
    enabled: !!user && user.role === "student",
  });

  // 2c. Fetch teacher operational analytics if teacher
  const { data: teacherAnalytics } = useQuery<TeacherAnalytics>({
    queryKey: ["teacher-analytics"],
    queryFn: () => api.get("/analytics/teacher"),
    enabled: !!user && user.role === "teacher",
  });

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success(`Copied classroom code ${code}`);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      toast.error("Failed to copy join code");
    }
  };

  // 3. Join classroom mutation (Student only)
  const joinMutation = useMutation({
    mutationFn: (data: JoinClassroomFields) => api.post("/classrooms/join", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      setShowJoinModal(false);
      joinForm.reset();
    },
    onError: (error: any) => {
      setErrorMsg(error.message || "Failed to join classroom");
    },
  });

  // 4. Create classroom mutation (Teacher only)
  const createMutation = useMutation({
    mutationFn: (data: CreateClassroomFields) => api.post("/classrooms", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      setShowCreateModal(false);
      createForm.reset();
    },
    onError: (error: any) => {
      setErrorMsg(error.message || "Failed to create classroom");
    },
  });

  // 5. Logout mutation
  const logoutMutation = useMutation({
    mutationFn: () => {
      if (typeof window !== "undefined") {
        (window as any).__IS_LOGGING_OUT = true;
      }
      return api.post("/auth/logout");
    },
    onSuccess: () => {
      if (typeof document !== "undefined") {
        document.cookie = "access_token=; path=/; max-age=0; SameSite=Lax";
      }
      queryClient.clear();
      router.push("/auth/login");
      router.refresh();
      setTimeout(() => {
        if (typeof window !== "undefined") {
          (window as any).__IS_LOGGING_OUT = false;
        }
      }, 1000);
    },
    onError: () => {
      queryClient.clear();
      router.push("/auth/login");
      router.refresh();
      setTimeout(() => {
        if (typeof window !== "undefined") {
          (window as any).__IS_LOGGING_OUT = false;
        }
      }, 1000);
    },
  });

  const joinForm = useForm<JoinClassroomFields>({
    resolver: zodResolver(joinClassroomSchema),
  });

  const createForm = useForm<CreateClassroomFields>({
    resolver: zodResolver(createClassroomSchema),
  });

  if (userLoading || classroomsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse text-sm font-medium">
          Loading academic workspace...
        </p>
      </div>
    );
  }

  const isStudent = user?.role === "student";
  const userDisplayName = user?.profile?.name || user?.email || "Academic User";

  return (
    <div className="min-h-screen bg-textured-workspace text-foreground flex flex-col">
      {/* Dynamic Header Functional Layer (Apple Liquid Glass Floating Capsule Bar) */}
      <header className="fixed top-4 left-4 sm:left-8 md:left-16 right-4 sm:right-8 md:right-16 z-40 flex items-center justify-between px-5 py-2.5 bg-gradient-to-b from-white/80 via-white/65 to-white/50 dark:from-zinc-900/85 dark:via-zinc-900/75 dark:to-zinc-950/70 backdrop-blur-2xl backdrop-saturate-180 border border-white/80 dark:border-white/15 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.1),_inset_0_1px_1px_0_rgba(255,255,255,0.95),_inset_0_-1px_1px_0_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7),_inset_0_1px_1px_0_rgba(255,255,255,0.18),_inset_0_-1px_1px_0_rgba(0,0,0,0.5)] rounded-2xl select-none transition-all duration-300">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5 group select-none">
            <img
              src="/logo.png"
              alt="eJournal Icon"
              className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <span className="font-bold text-lg tracking-tight text-foreground">
              eJournal
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <NotificationBell />

          {(user?.is_admin || user?.isAdmin || user?.role === "admin") && (
            <Link href="/admin" title="Open Institutional Admin Command Center">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-bold rounded-xl h-8 px-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                <ShieldAlert className="size-3.5 text-amber-500" />
                <span className="hidden sm:inline font-bold">Admin Console</span>
              </Button>
            </Link>
          )}

          <Link href="/profile" title="View & Edit Academic Profile">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-xs font-semibold rounded-xl h-8 px-2.5 hover:bg-muted/80 text-foreground cursor-pointer transition-all hover:scale-105 active:scale-95 border border-border/50"
            >
              <div className="size-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
                <User className="size-3" />
              </div>
              <span className="hidden sm:inline font-semibold">{userDisplayName}</span>
            </Button>
          </Link>

          <Button
            variant="ghost"
            color="neutral"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="gap-1.5 text-xs font-medium rounded-xl h-8 px-2.5 bg-transparent border border-rose-500/20 text-rose-700/75 dark:text-rose-300/75 hover:bg-rose-500/8 hover:border-rose-500/40 hover:text-rose-700 dark:hover:text-rose-200 active:scale-95 transition-all duration-150 cursor-pointer"
            title="Sign out of eJournal"
          >
            <LogOut className="size-3.5 text-rose-600/70 dark:text-rose-400/70" />
            <span>Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 pt-24 md:pt-24 flex flex-col gap-8 relative z-10">
        {/* Teacher vs Student Workspace Hero & Operational Telemetry */}
        {isStudent ? (
          <>
            {/* Student Banner */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 md:p-8 rounded-3xl glass-card relative overflow-hidden transition-all duration-300">
              <div className="flex flex-col gap-1.5 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                    <Sparkles className="size-3" />
                    Student Workspace
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                  Welcome back, {userDisplayName}
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Access your active laboratory practicals, write mathematical journals, and track teacher reviews.
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                <Button
                  onClick={() => setShowJoinModal(true)}
                  size="default"
                  className="gap-2 font-semibold rounded-xl h-10 px-5 active:scale-95 transition-all duration-150 cursor-pointer"
                >
                  <UserPlus className="size-4" />
                  <span>Join Classroom</span>
                </Button>
              </div>
            </div>

            {/* Student 3 Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl glass-card flex items-center justify-between gap-4 hover:scale-[1.02] transition-all duration-300">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Enrolled Subjects
                  </span>
                  <span className="text-2xl font-extrabold text-foreground">
                    {classrooms?.length || 0}
                  </span>
                </div>
                <div className="size-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <BookOpen className="size-5.5" />
                </div>
              </div>

              <div className="p-5 rounded-2xl glass-card flex items-center justify-between gap-4 hover:scale-[1.02] transition-all duration-300">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Department
                  </span>
                  <span className="text-base font-bold text-foreground line-clamp-1">
                    {user?.profile?.department || "Computer Engineering"}
                  </span>
                </div>
                <div className="size-11 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                  <Building2 className="size-5.5" />
                </div>
              </div>

              <div className="p-5 rounded-2xl glass-card flex items-center justify-between gap-4 hover:scale-[1.02] transition-all duration-300">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Account Role
                  </span>
                  <span className="text-base font-bold text-foreground capitalize">
                    {user?.role || "Student"}
                  </span>
                </div>
                <div className="size-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <GraduationCap className="size-5.5" />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Faculty Welcome Deck (Seamless Surface, No Awkward Card Bubble) */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-1">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary tracking-wide">
                    <Sparkles className="size-3.5" />
                    Faculty Review Console
                  </span>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {user?.profile?.department || "Computer Engineering"}
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                  Welcome back, {userDisplayName}
                </h1>
                <p className="text-sm text-muted-foreground max-w-xl">
                  Track student practical submissions, conduct in-line reviews, and manage lab evaluation batches.
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                <Button
                  onClick={() => setShowCreateModal(true)}
                  size="default"
                  className="gap-2 font-semibold rounded-xl h-10 px-5 shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  <Plus className="size-4" />
                  <span>Create Classroom</span>
                </Button>
              </div>
            </div>

            {/* Unified Executive Telemetry Cockpit (Single Cohesive Glass Bar, Zero Card Syndrome) */}
            <div className="rounded-2xl glass-card border border-border/80 shadow-xs divide-y md:divide-y-0 md:divide-x divide-border/60 grid grid-cols-1 md:grid-cols-3 overflow-hidden">
              {/* Sector 1: Review Queue */}
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Awaiting Review
                    </span>
                    {(teacherAnalytics?.pendingSubmissions ?? 0) > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        Action Needed
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-extrabold tracking-tight text-foreground">
                      {teacherAnalytics?.pendingSubmissions ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {(teacherAnalytics?.pendingSubmissions ?? 0) > 0
                        ? "Submissions queued"
                        : "All clear"}
                    </span>
                  </div>
                </div>
                <div
                  className={`size-11 rounded-xl flex items-center justify-center border shrink-0 ${
                    (teacherAnalytics?.pendingSubmissions ?? 0) > 0
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                  }`}
                >
                  <Clock className="size-5.5" />
                </div>
              </div>

              {/* Sector 2: Student Enrollment */}
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Enrolled Students
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-extrabold tracking-tight text-foreground">
                      {teacherAnalytics?.totalStudents ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      Across {classrooms?.length || 0} active batches
                    </span>
                  </div>
                </div>
                <div className="size-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/25 shrink-0">
                  <Users className="size-5.5" />
                </div>
              </div>

              {/* Sector 3: Curriculum Practicals */}
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Active Practicals
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-extrabold tracking-tight text-foreground">
                      {teacherAnalytics?.totalAssignments ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      Published across {classrooms?.length || 0} {classrooms?.length === 1 ? "batch" : "batches"}
                    </span>
                  </div>
                </div>
                <div className="size-11 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/25 shrink-0">
                  <FlaskConical className="size-5.5" />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20 max-w-md">
            {errorMsg}
          </div>
        )}

        {/* Student Academic Progress & Performance Summary Widget */}
        {isStudent && analytics && analytics.totalAssigned > 0 && (
          <div className="p-6 sm:p-7 rounded-3xl glass-card border border-border/80 shadow-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative overflow-hidden group">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-1/4 w-96 h-32 bg-gradient-to-r from-primary/5 via-accent/5 to-emerald-500/5 blur-3xl pointer-events-none -z-10" />

            <div className="flex flex-col gap-3 max-w-lg w-full">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                    <Sparkles className="size-3.5" />
                  </div>
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
                    Continuous Assessment Tracker
                  </span>
                </div>

                {/* Dynamic Academic Standing Badge */}
                {analytics.cumulativeAverageScore >= 80 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <Award className="size-3" /> Distinction Standing
                  </span>
                ) : analytics.cumulativeAverageScore >= 60 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> First Class Standing
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                    <Clock className="size-3" /> Assessment Active
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                  {analytics.completedApproved} of {analytics.totalAssigned} Practicals Completed
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                  {analytics.completedApproved === analytics.totalAssigned
                    ? "All laboratory coursework evaluated and completed for this term!"
                    : `${analytics.totalAssigned - analytics.completedApproved} experiment${analytics.totalAssigned - analytics.completedApproved === 1 ? "" : "s"} remaining across your active classroom workspaces.`}
                </p>
              </div>

              {/* Multi-Segmented Trajectory Progress Bar */}
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="w-full bg-muted/70 h-3 rounded-full overflow-hidden border border-border/50 p-0.5 flex items-center gap-0.5 shadow-inner">
                  {analytics.completedApproved > 0 && (
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700 shadow-xs"
                      style={{
                        width: `${Math.round((analytics.completedApproved / analytics.totalAssigned) * 100)}%`,
                      }}
                      title={`Approved & Graded: ${analytics.completedApproved}`}
                    />
                  )}
                  {analytics.submittedPending > 0 && (
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-700 shadow-xs"
                      style={{
                        width: `${Math.round((analytics.submittedPending / analytics.totalAssigned) * 100)}%`,
                      }}
                      title={`Under Review: ${analytics.submittedPending}`}
                    />
                  )}
                  {(analytics.totalAssigned - analytics.completedApproved - analytics.submittedPending) > 0 && (
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all duration-700 shadow-xs"
                      style={{
                        width: `${Math.round(((analytics.totalAssigned - analytics.completedApproved - analytics.submittedPending) / analytics.totalAssigned) * 100)}%`,
                      }}
                      title={`To Complete / In Progress: ${analytics.totalAssigned - analytics.completedApproved - analytics.submittedPending}`}
                    />
                  )}
                </div>

                {/* Progress Bar Legend */}
                <div className="flex items-center gap-3.5 text-[11px] font-bold text-muted-foreground pt-0.5 flex-wrap">
                  {analytics.completedApproved > 0 && (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <span className="size-2 rounded-full bg-emerald-500 shadow-xs" />
                      {analytics.completedApproved} Approved
                    </span>
                  )}
                  {analytics.submittedPending > 0 && (
                    <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                      <span className="size-2 rounded-full bg-indigo-500 shadow-xs" />
                      {analytics.submittedPending} In Review
                    </span>
                  )}
                  {(analytics.totalAssigned - analytics.completedApproved - analytics.submittedPending) > 0 && (
                    <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <span className="size-2 rounded-full bg-amber-500 shadow-xs" />
                      {analytics.totalAssigned - analytics.completedApproved - analytics.submittedPending} To Complete
                      {analytics.inProgress > 0 ? ` (${analytics.inProgress} in progress)` : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 w-full lg:w-auto shrink-0">
              <div className="p-4 rounded-2xl glass-card border border-border/70 hover:border-emerald-500/30 hover:scale-[1.02] transition-all duration-200 flex flex-col items-center justify-center text-center group/card">
                <div className="flex items-center gap-1.5 mb-1 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="size-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Avg. Score</span>
                </div>
                <span className="text-2xl font-black text-foreground tracking-tight">
                  {analytics.cumulativeAverageScore}%
                </span>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Continuous Scale
                </span>
              </div>

              <div className="p-4 rounded-2xl glass-card border border-border/70 hover:border-indigo-500/30 hover:scale-[1.02] transition-all duration-200 flex flex-col items-center justify-center text-center group/card">
                <div className="flex items-center gap-1.5 mb-1 text-indigo-600 dark:text-indigo-400">
                  <Clock className="size-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">In Review</span>
                </div>
                <span className="text-2xl font-black text-foreground tracking-tight">
                  {analytics.submittedPending}
                </span>
                <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  With Teacher
                </span>
              </div>

              <div className="p-4 rounded-2xl glass-card border border-border/70 hover:border-amber-500/30 hover:scale-[1.02] transition-all duration-200 flex flex-col items-center justify-center text-center group/card">
                <div className="flex items-center gap-1.5 mb-1 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="size-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {analytics.inProgress > 0 ? "In Progress" : "Pending"}
                  </span>
                </div>
                <span className="text-2xl font-black text-foreground tracking-tight">
                  {analytics.totalAssigned - analytics.completedApproved - analytics.submittedPending}
                </span>
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                  {analytics.inProgress > 0 ? `${analytics.inProgress} In Progress` : "To Complete"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Section Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
              My Classroom Workspaces
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
              {classrooms?.length || 0}
            </span>
          </div>
        </div>

        {/* Classrooms Grid (Elevated Apple-Style Cards with Visual Batch Identity) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classrooms && classrooms.length > 0 ? (
            classrooms.map((room, idx) => {
              const stats = teacherAnalytics?.classroomsStats?.[room.id];
              const studentCount = stats?.studentCount ?? 0;
              const assignmentCount = stats?.assignmentCount ?? 0;
              const pendingReview = stats?.pendingReviewCount ?? 0;
              const theme = getClassroomTheme(room.id, idx);

              return (
                <div
                  key={room.id}
                  onClick={() => router.push(`/classrooms/${room.id}`)}
                  className={cn(
                    "group relative p-6 rounded-2xl glass-card hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between min-h-[220px] cursor-pointer overflow-hidden border border-border/70",
                    theme.hoverBorder
                  )}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/classrooms/${room.id}`);
                    }
                  }}
                >
                  {/* Option C: Vertical Batch Anchor Notch */}
                  <div
                    className={cn(
                      "absolute left-0 top-6 bottom-6 w-[3.5px] rounded-r-full transition-opacity duration-200 opacity-80 group-hover:opacity-100",
                      theme.indicator
                    )}
                  />

                  <div>
                    {/* Top Row: Subject Tag + Division & Copy Join Code */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-md text-[11px] border tracking-wide",
                            theme.badge
                          )}
                        >
                          {room.subject}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">
                          Div {room.division}
                        </span>
                      </div>

                      {!isStudent && room.joinCode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyCode(room.joinCode);
                          }}
                          title="Click to copy join code"
                          className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 rounded-lg border border-primary/20 transition-all active:scale-95 cursor-pointer"
                        >
                          <span>{room.joinCode}</span>
                          {copiedCode === room.joinCode ? (
                            <Check className="size-3 text-emerald-500 animate-in zoom-in" />
                          ) : (
                            <Copy className="size-3 opacity-60 group-hover:opacity-100" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Title & Department */}
                    <div className="mt-4">
                      <h3
                        className={cn(
                          "font-extrabold text-xl tracking-tight text-foreground line-clamp-1 transition-colors",
                          theme.hoverTitle
                        )}
                      >
                        {room.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {room.department} • {room.semester}
                      </p>
                    </div>

                    {/* Live Telemetry Strip */}
                    {!isStudent && (
                      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/40 text-xs text-muted-foreground font-medium">
                        <div
                          className="flex items-center gap-1.5"
                          title={`${studentCount} enrolled students`}
                        >
                          <Users className="size-3.5 text-primary/70" />
                          <span>{studentCount} Students</span>
                        </div>
                        <span className="text-border/60">•</span>
                        <div
                          className="flex items-center gap-1.5"
                          title={`${assignmentCount} practical experiments`}
                        >
                          <FlaskConical className="size-3.5 text-indigo-500/70" />
                          <span>{assignmentCount} Practicals</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Action & Evaluation Status */}
                  <div className="flex items-center justify-between border-t border-border/60 pt-4 mt-3">
                    <div>
                      {!isStudent && (
                        pendingReview > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            <Clock className="size-3" />
                            {pendingReview} to review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="size-3" />
                            All caught up
                          </span>
                        )
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-bold text-primary group-hover:translate-x-1 transition-transform duration-150">
                      <span>{isStudent ? "View Workspace" : "Open Workspace"}</span>
                      <ArrowRight className="size-3.5" />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl glass-card">
              <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <BookOpen className="size-7" />
              </div>
              <h3 className="font-extrabold text-xl tracking-tight">No workspaces found</h3>
              <p className="text-xs text-muted-foreground mt-1.5 text-center max-w-sm leading-relaxed">
                {isStudent
                  ? "You haven't joined any classrooms yet. Click 'Join Classroom' and enter the join code provided by your teacher."
                  : "You haven't created any classrooms yet. Click 'Create Classroom' to start publishing practical assignments."}
              </p>
              <div className="mt-5">
                {isStudent ? (
                  <Button onClick={() => setShowJoinModal(true)} size="sm" className="rounded-xl">
                    Join Classroom Now
                  </Button>
                ) : (
                  <Button onClick={() => setShowCreateModal(true)} size="sm" className="rounded-xl">
                    Create Classroom Now
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Join Classroom Modal (Student only) */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
          <div className="glass-card w-full max-w-[400px] p-6 rounded-3xl flex flex-col gap-4">
            <h3 className="font-bold text-xl tracking-tight">Join Classroom</h3>
            <form onSubmit={joinForm.handleSubmit((data) => joinMutation.mutate(data))} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Join Code</label>
                <input
                  type="text"
                  placeholder="e.g. CS401-7F2A"
                  className="h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...joinForm.register("joinCode")}
                />
                {joinForm.formState.errors.joinCode && (
                  <span className="text-xs text-destructive">{joinForm.formState.errors.joinCode.message}</span>
                )}
              </div>

              <div className="flex items-center gap-3 justify-end mt-2">
                <Button type="button" variant="outline" onClick={() => setShowJoinModal(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={joinMutation.isPending} className="rounded-xl">
                  {joinMutation.isPending ? "Joining..." : "Join"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Classroom Modal (Teacher only) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
          <div className="glass-card w-full max-w-[450px] p-6 rounded-3xl flex flex-col gap-4">
            <h3 className="font-bold text-xl tracking-tight">Create Classroom</h3>
            <form onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Classroom Name</label>
                <input
                  type="text"
                  placeholder="e.g. OS Practicals Batch A"
                  className="h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...createForm.register("name")}
                />
                {createForm.formState.errors.name && (
                  <span className="text-xs text-destructive">{createForm.formState.errors.name.message}</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Subject Code / Title</label>
                <input
                  type="text"
                  placeholder="e.g. CS401"
                  className="h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...createForm.register("subject")}
                />
                {createForm.formState.errors.subject && (
                  <span className="text-xs text-destructive">{createForm.formState.errors.subject.message}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Semester</label>
                  <input
                    type="text"
                    placeholder="e.g. Semester V"
                    className="h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    {...createForm.register("semester")}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Division</label>
                  <input
                    type="text"
                    placeholder="e.g. Division A"
                    className="h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    {...createForm.register("division")}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Department</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Engineering"
                  className="h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...createForm.register("department")}
                />
                {createForm.formState.errors.department && (
                  <span className="text-xs text-destructive">{createForm.formState.errors.department.message}</span>
                )}
              </div>

              <div className="flex items-center gap-3 justify-end mt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} className="rounded-xl">
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
