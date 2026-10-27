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
import { getClassroomTheme } from "@/lib/classroom-theme";
import { AppLoadingScreen } from "@/components/ui/app-loading-screen";

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
      <AppLoadingScreen
        title="Loading Academic Workspace..."
        subtitle="Fetching your classrooms and academic schedule..."
      />
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
            {/* Student Welcome Deck (Seamless Surface, Zero Card Syndrome) */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-1">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary tracking-wide">
                    <Sparkles className="size-3.5" />
                    Student Academic Workspace
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
                  Access your active laboratory practicals, write mathematical journals, and track teacher reviews.
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                <Button
                  onClick={() => setShowJoinModal(true)}
                  size="default"
                  className="gap-2 font-semibold rounded-xl h-10 px-5 shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  <UserPlus className="size-4" />
                  <span>Join Classroom</span>
                </Button>
              </div>
            </div>

            {/* Unified Student Telemetry Cockpit (Single Cohesive Glass Bar, Zero Card Syndrome) */}
            <div className="rounded-2xl glass-card border border-border/80 shadow-xs divide-y md:divide-y-0 md:divide-x divide-border/60 grid grid-cols-1 md:grid-cols-3 overflow-hidden">
              {/* Sector 1: Coursework Progress */}
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Coursework Completed
                    </span>
                    {(analytics?.completedApproved ?? 0) === (analytics?.totalAssigned ?? 0) && (analytics?.totalAssigned ?? 0) > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        100% Done
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-extrabold tracking-tight text-foreground">
                      {analytics?.completedApproved ?? 0}
                      <span className="text-lg font-bold text-muted-foreground/60"> / {analytics?.totalAssigned ?? 0}</span>
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {(analytics?.totalAssigned ?? 0) - (analytics?.completedApproved ?? 0) === 0 && (analytics?.totalAssigned ?? 0) > 0
                        ? "All evaluated"
                        : `${(analytics?.totalAssigned ?? 0) - (analytics?.completedApproved ?? 0)} remaining`}
                    </span>
                  </div>
                </div>
                <div className="size-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/25 shrink-0">
                  <CheckCircle2 className="size-5.5" />
                </div>
              </div>

              {/* Sector 2: Teacher Evaluation Status */}
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Teacher Reviews
                    </span>
                    {(analytics?.changesRequested ?? 0) > 0 ? (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        Changes Requested
                      </span>
                    ) : (analytics?.submittedPending ?? 0) > 0 ? (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                        Under Review
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-extrabold tracking-tight text-foreground">
                      {analytics?.submittedPending ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {(analytics?.submittedPending ?? 0) > 0 ? "With instructor" : "All up to date"}
                    </span>
                  </div>
                </div>
                <div className="size-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/25 shrink-0">
                  <Clock className="size-5.5" />
                </div>
              </div>

              {/* Sector 3: Active Classroom Workspaces */}
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Enrolled Subjects
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-extrabold tracking-tight text-foreground">
                      {classrooms?.length || 0}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {user?.profile?.semester ? `Semester ${user.profile.semester}` : "Active Cohort"}
                    </span>
                  </div>
                </div>
                <div className="size-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/25 shrink-0">
                  <BookOpen className="size-5.5" />
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

              // Per-classroom student telemetry
              const cProgress = analytics?.classroomsProgress?.find((cp: any) => cp.classroomId === room.id);
              const studentTotal = cProgress?.total ?? 0;
              const studentCompleted = cProgress?.completed ?? 0;
              const studentPending = cProgress?.pending ?? 0;
              const pct = studentTotal > 0 ? Math.round((studentCompleted / studentTotal) * 100) : 0;

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
                    {isStudent ? (
                      <div className="flex flex-col gap-2 mt-4 pt-3 border-t border-border/40">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                            <FlaskConical className="size-3.5 text-primary/80" />
                            {studentCompleted} / {studentTotal} Practicals Done
                          </span>
                          {studentTotal > 0 && (
                            <span className="font-bold text-xs text-foreground font-mono">
                              {pct}%
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-muted/70 h-2 rounded-full overflow-hidden border border-border/40 p-0.5 shadow-inner">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500 shadow-2xs"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    ) : (
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
                      {isStudent ? (
                        studentPending > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                            <Clock className="size-3" />
                            {studentPending} in review
                          </span>
                        ) : studentCompleted === studentTotal && studentTotal > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="size-3" />
                            All completed
                          </span>
                        ) : studentTotal > studentCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            <AlertCircle className="size-3" />
                            {studentTotal - studentCompleted} remaining
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-muted-foreground bg-muted/40 border border-border/40">
                            No practicals
                          </span>
                        )
                      ) : (
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
