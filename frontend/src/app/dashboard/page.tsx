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
      {/* Grounded Institutional Archival Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 backdrop-blur-xs px-4 sm:px-8 py-3 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5 group select-none">
            <img
              src="/logo.png"
              alt="eJournal Icon"
              className="h-7 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <span className="font-bold text-base tracking-tight text-foreground font-serif">
              eJournal
            </span>
          </Link>
          <span className="text-muted-foreground/30 font-light select-none hidden sm:inline">/</span>
          <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
            {isStudent ? "Student workspace" : "Faculty review console"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <ThemeToggle />
          <NotificationBell />

          {(user?.is_admin || user?.isAdmin || user?.role === "admin") && (
            <Link href="/admin" title="Open Institutional Admin Command Center">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-semibold rounded-md h-8 px-2.5 glass-btn-accent-outline cursor-pointer"
              >
                <ShieldAlert className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden sm:inline">Admin console</span>
              </Button>
            </Link>
          )}

          <Link href="/profile" title="View & Edit Academic Profile" className="hidden sm:inline-flex">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs font-semibold rounded-md h-8 px-2.5 glass-btn-elevated cursor-pointer"
            >
              <div className="size-5 rounded bg-muted text-foreground flex items-center justify-center font-bold text-[10px]">
                <User className="size-3" />
              </div>
              <span className="hidden sm:inline">{userDisplayName}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="gap-1.5 text-xs font-semibold rounded-md h-8 px-2.5 glass-btn-rose-outline cursor-pointer"
            title="Sign out of eJournal"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 pb-24 sm:p-6 sm:pb-8 md:p-8 flex flex-col gap-6 relative z-10">
        {/* Teacher vs Student Workspace Hero & Operational Telemetry */}
        {isStudent ? (
          <>
            {/* Student Welcome Deck */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <GraduationCap className="size-3.5" />
                    Student workspace
                  </span>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {user?.profile?.department || "Computer Engineering"}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-serif">
                  Welcome back, {userDisplayName}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
                  Active laboratory practicals, mathematical journals, and teacher review records.
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                <Button
                  onClick={() => setShowJoinModal(true)}
                  size="sm"
                  className="gap-2 font-medium rounded-md h-9 px-4 shadow-xs glass-btn-indigo-solid active:scale-[0.98] transition-all cursor-pointer"
                >
                  <UserPlus className="size-3.5" />
                  <span>Join classroom</span>
                </Button>
              </div>
            </div>

            {/* Unified Student Telemetry Cockpit */}
            <div className="rounded-lg border border-border/80 bg-card shadow-xs divide-y md:divide-y-0 md:divide-x divide-border/80 grid grid-cols-1 md:grid-cols-3 overflow-hidden">
              {/* Sector 1: Coursework Progress */}
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Coursework completed
                    </span>
                    {(analytics?.completedApproved ?? 0) === (analytics?.totalAssigned ?? 0) && (analytics?.totalAssigned ?? 0) > 0 && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold tabular-nums bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                        100% done
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold tracking-tight font-sans tabular-nums text-foreground">
                      {analytics?.completedApproved ?? 0}
                      <span className="text-lg font-normal text-muted-foreground"> / {analytics?.totalAssigned ?? 0}</span>
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {(analytics?.totalAssigned ?? 0) - (analytics?.completedApproved ?? 0) === 0 && (analytics?.totalAssigned ?? 0) > 0
                        ? "All evaluated"
                        : `${(analytics?.totalAssigned ?? 0) - (analytics?.completedApproved ?? 0)} remaining`}
                    </span>
                  </div>
                </div>
                <div className="size-10 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
                  <CheckCircle2 className="size-5" />
                </div>
              </div>

              {/* Sector 2: Teacher Evaluation Status */}
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Teacher reviews
                    </span>
                    {(analytics?.changesRequested ?? 0) > 0 ? (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                        Changes requested
                      </span>
                    ) : (analytics?.submittedPending ?? 0) > 0 ? (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/25">
                        Under review
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold tracking-tight font-sans tabular-nums text-foreground">
                      {analytics?.submittedPending ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {(analytics?.submittedPending ?? 0) > 0 ? "With instructor" : "All up to date"}
                    </span>
                  </div>
                </div>
                <div className="size-10 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
                  <Clock className="size-5" />
                </div>
              </div>

              {/* Sector 3: Active Classroom Workspaces */}
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Enrolled subjects
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold tracking-tight font-sans tabular-nums text-foreground">
                      {classrooms?.length || 0}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {user?.profile?.semester ? `Semester ${user.profile.semester}` : "Active cohort"}
                    </span>
                  </div>
                </div>
                <div className="size-10 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0">
                  <BookOpen className="size-5" />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Faculty Welcome Deck */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Building2 className="size-3.5" />
                    Faculty review console
                  </span>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {user?.profile?.department || "Computer Engineering"}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-serif">
                  Welcome back, {userDisplayName}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
                  Student practical submissions, in-line reviews, and laboratory evaluation cohorts.
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                <Button
                  onClick={() => setShowCreateModal(true)}
                  size="sm"
                  className="gap-2 font-medium rounded-md h-9 px-4 shadow-xs glass-btn-indigo-solid active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>Create classroom</span>
                </Button>
              </div>
            </div>

            {/* Unified Executive Telemetry Cockpit */}
            <div className="rounded-lg border border-border/80 bg-card shadow-xs divide-y md:divide-y-0 md:divide-x divide-border/80 grid grid-cols-1 md:grid-cols-3 overflow-hidden">
              {/* Sector 1: Review Queue */}
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Awaiting review
                    </span>
                    {(teacherAnalytics?.pendingSubmissions ?? 0) > 0 && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                        Action needed
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold tracking-tight font-sans tabular-nums text-foreground">
                      {teacherAnalytics?.pendingSubmissions ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {(teacherAnalytics?.pendingSubmissions ?? 0) > 0
                        ? "Submissions queued"
                        : "All clear"}
                    </span>
                  </div>
                </div>
                <div className="size-10 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
                  <Clock className="size-5" />
                </div>
              </div>

              {/* Sector 2: Student Enrollment */}
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Enrolled students
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold tracking-tight font-sans tabular-nums text-foreground">
                      {teacherAnalytics?.totalStudents ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      Across {classrooms?.length || 0} active batches
                    </span>
                  </div>
                </div>
                <div className="size-10 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0">
                  <Users className="size-5" />
                </div>
              </div>

              {/* Sector 3: Curriculum Practicals */}
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Active practicals
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold tracking-tight font-sans tabular-nums text-foreground">
                      {teacherAnalytics?.totalAssignments ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      Published across {classrooms?.length || 0} {classrooms?.length === 1 ? "batch" : "batches"}
                    </span>
                  </div>
                </div>
                <div className="size-10 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-500/20 shrink-0">
                  <FlaskConical className="size-5" />
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



        {/* Section Title with Accessible Navigation Anchors */}
        <div id="classroom-workspaces" className="flex items-center justify-between scroll-mt-24">
          <div id="classrooms" className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground font-serif">
              My classroom workspaces
            </h2>
            <span className="px-2 py-0.5 rounded text-xs font-semibold tabular-nums bg-muted text-muted-foreground border border-border">
              {classrooms?.length || 0}
            </span>
          </div>
        </div>

        {/* Classrooms Grid (Archival Monograph Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                    "group relative p-5 rounded-xl border border-border/80 bg-card hover:border-border hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[208px] cursor-pointer overflow-hidden",
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
                  {/* Vertical Batch Anchor Notch with subject glow */}
                  <div
                    className={cn(
                      "absolute left-0 top-4 bottom-4 w-1 rounded-r-full transition-all duration-200",
                      theme.indicator,
                      theme.notchGlow
                    )}
                  />

                  <div>
                    {/* Top Row: Subject Tag + Division & Copy Join Code */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[11px] border tracking-wide font-medium",
                            theme.badge
                          )}
                        >
                          {room.subject}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">
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
                          className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium bg-muted hover:bg-muted/80 text-foreground px-2 py-0.5 rounded border border-border transition-all active:scale-[0.98] cursor-pointer"
                        >
                          <span>{room.joinCode}</span>
                          {copiedCode === room.joinCode ? (
                            <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="size-3 opacity-60 group-hover:opacity-100" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Title & Department */}
                    <div className="mt-3.5">
                      <h3
                        className={cn(
                          "font-bold text-base tracking-tight text-foreground line-clamp-1 transition-colors font-serif",
                          theme.hoverTitle
                        )}
                      >
                        {room.name}
                      </h3>
                      <p className="text-xs text-muted-foreground font-medium mt-1">
                        {room.department} • Semester {room.semester}
                      </p>
                    </div>

                    {/* Live Telemetry Strip */}
                    {isStudent ? (
                      <div className="flex flex-col gap-2 mt-4 pt-3 border-t border-border/40">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                            <FlaskConical className={cn("size-3", theme.accentText)} />
                            {studentCompleted} / {studentTotal} practicals done
                          </span>
                          {studentTotal > 0 && (
                            <span className="font-bold text-xs text-foreground tabular-nums">
                              {pct}%
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-muted/80 h-1.5 rounded-full overflow-hidden border border-border/50">
                          <div
                            className={cn("h-full rounded-full transition-all duration-500", theme.indicator)}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/40 text-xs text-muted-foreground font-medium">
                        <div
                          className="flex items-center gap-1.5 tabular-nums"
                          title={`${studentCount} enrolled ${studentCount === 1 ? "student" : "students"}`}
                        >
                          <Users className="size-3 text-muted-foreground" />
                          <span>{studentCount} {studentCount === 1 ? "student" : "students"}</span>
                        </div>
                        <span className="text-border/60">•</span>
                        <div
                          className="flex items-center gap-1.5 tabular-nums"
                          title={`${assignmentCount} practical ${assignmentCount === 1 ? "experiment" : "experiments"}`}
                        >
                          <FlaskConical className="size-3 text-muted-foreground" />
                          <span>{assignmentCount} {assignmentCount === 1 ? "practical" : "practicals"}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Action & Evaluation Status */}
                  <div className="flex items-center justify-between border-t border-border/40 pt-3 mt-3">
                    <div>
                      {isStudent ? (
                        studentPending > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            <Clock className="size-3" />
                            {studentPending} in review
                          </span>
                        ) : studentCompleted === studentTotal && studentTotal > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                            All completed
                          </span>
                        ) : studentTotal > studentCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            <AlertCircle className="size-3" />
                            {studentTotal - studentCompleted} remaining
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-muted-foreground bg-muted border border-border">
                            No practicals
                          </span>
                        )
                      ) : (
                        pendingReview > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            <Clock className="size-3" />
                            {pendingReview} to review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                            All caught up
                          </span>
                        )
                      )}
                    </div>

                    <div className={cn(
                      "flex items-center gap-1 text-xs font-semibold group-hover:translate-x-0.5 transition-transform duration-150",
                      theme.accentText
                    )}>
                      <span>{isStudent ? "View workspace" : "Open workspace"}</span>
                      <ArrowRight className="size-3.5" />
                    </div>
                  </div>
                </div>
              );
            })
            .concat(
              !isStudent && classrooms.length > 0 && classrooms.length % 3 !== 0 ? [
                <button
                  key="create-new-cohort-placeholder"
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="p-5 rounded-xl border-2 border-dashed border-border/70 hover:border-primary/50 bg-card hover:bg-muted/40 transition-all flex flex-col items-center justify-center gap-2.5 text-center min-h-[208px] cursor-pointer group select-none shadow-2xs"
                >
                  <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus className="size-5" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-foreground">Create new cohort</span>
                    <span className="text-[11px] text-muted-foreground">Add another division or subject space</span>
                  </div>
                </button>
              ] : []
            )
          ) : (
            <div className="col-span-full py-14 flex flex-col items-center justify-center border border-dashed border-border rounded-lg bg-card/50">
              <div className="size-12 rounded-md bg-muted text-foreground flex items-center justify-center mb-3 border border-border">
                <BookOpen className="size-6" />
              </div>
              <h3 className="font-bold text-lg tracking-tight font-serif">No workspaces found</h3>
              <p className="text-xs text-muted-foreground mt-1 text-center max-w-sm leading-relaxed">
                {isStudent
                  ? "You haven't joined any classrooms yet. Click 'Join classroom' and enter the join code provided by your instructor."
                  : "You haven't created any classrooms yet. Click 'Create classroom' to start publishing practical assignments."}
              </p>
              <div className="mt-4">
                {isStudent ? (
                  <Button onClick={() => setShowJoinModal(true)} variant="outline" size="sm" className="rounded-lg h-8 px-3 text-xs font-semibold glass-btn-frosted shadow-xs">
                    Join classroom
                  </Button>
                ) : (
                  <Button onClick={() => setShowCreateModal(true)} size="sm" className="rounded-lg h-8 px-3.5 text-xs font-semibold glass-btn-indigo-solid shadow-xs">
                    Create classroom
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Join Classroom Modal (Student only) */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-120">
          <div className="bg-popover border border-border shadow-lg rounded-lg w-full max-w-sm p-6 flex flex-col gap-4">
            <h3 className="font-bold text-lg tracking-tight font-serif">Join classroom</h3>
            <form onSubmit={joinForm.handleSubmit((data) => joinMutation.mutate(data))} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Classroom join code</label>
                <input
                  type="text"
                  placeholder="e.g. CS401-7F2A"
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-mono uppercase tracking-widest text-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...joinForm.register("joinCode")}
                />
                {joinForm.formState.errors.joinCode && (
                  <span className="text-xs text-destructive">{joinForm.formState.errors.joinCode.message}</span>
                )}
              </div>

              <div className="flex items-center gap-2 justify-end mt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowJoinModal(false)} className="rounded-lg h-8 px-3 text-xs font-medium glass-btn-frosted">
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={joinMutation.isPending} className="rounded-lg h-8 px-4 text-xs font-semibold glass-btn-indigo-solid shadow-xs">
                  {joinMutation.isPending ? "Joining..." : "Join"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Classroom Modal (Teacher only) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-120">
          <div className="bg-popover border border-border shadow-lg rounded-lg w-full max-w-md p-6 flex flex-col gap-4">
            <h3 className="font-bold text-lg tracking-tight font-serif">Create classroom</h3>
            <form onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Classroom name</label>
                <input
                  type="text"
                  placeholder="e.g. Operating Systems Lab Batch A"
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...createForm.register("name")}
                />
                {createForm.formState.errors.name && (
                  <span className="text-xs text-destructive">{createForm.formState.errors.name.message}</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Subject code / title</label>
                <input
                  type="text"
                  placeholder="e.g. CS401"
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...createForm.register("subject")}
                />
                {createForm.formState.errors.subject && (
                  <span className="text-xs text-destructive">{createForm.formState.errors.subject.message}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Semester</label>
                  <input
                    type="text"
                    placeholder="e.g. Semester V"
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    {...createForm.register("semester")}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Division</label>
                  <input
                    type="text"
                    placeholder="e.g. Division A"
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    {...createForm.register("division")}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Department</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Engineering"
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...createForm.register("department")}
                />
                {createForm.formState.errors.department && (
                  <span className="text-xs text-destructive">{createForm.formState.errors.department.message}</span>
                )}
              </div>

              <div className="flex items-center gap-2 justify-end mt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateModal(false)} className="rounded-lg h-8 px-3 text-xs font-medium glass-btn-frosted">
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createMutation.isPending} className="rounded-lg h-8 px-4 text-xs font-semibold glass-btn-indigo-solid shadow-xs">
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
