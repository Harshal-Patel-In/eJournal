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
  FileCheck2,
  GraduationCap,
  Plus,
  Sparkles,
  UserPlus,
  User,
} from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";

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
    <div className="min-h-screen bg-slate-100/60 dark:bg-zinc-950 bg-textured-workspace text-foreground flex flex-col">
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
            variant="destructive"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="text-xs font-semibold rounded-xl h-8 active:scale-95 transition-all duration-150 ease-out cursor-pointer"
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 pt-24 md:pt-24 flex flex-col gap-8 relative z-10">
        {/* Banner Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 md:p-8 rounded-3xl glass-card relative overflow-hidden transition-all duration-300">
          <div className="flex flex-col gap-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                <Sparkles className="size-3" />
                {isStudent ? "Student Workspace" : "Faculty Review Console"}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              Welcome back, {userDisplayName}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isStudent
                ? "Access your active laboratory practicals, write mathematical journals, and track teacher reviews."
                : "Manage practical batches, publish lab experiments, annotate student drafts, and assign final grades."}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            {isStudent ? (
              <Button
                onClick={() => setShowJoinModal(true)}
                size="default"
                className="gap-2 font-semibold rounded-xl h-10 px-5 active:scale-95 transition-all duration-150 cursor-pointer"
              >
                <UserPlus className="size-4" />
                <span>Join Classroom</span>
              </Button>
            ) : (
              <Button
                onClick={() => setShowCreateModal(true)}
                size="default"
                className="gap-2 font-semibold rounded-xl h-10 px-5 active:scale-95 transition-all duration-150 cursor-pointer"
              >
                <Plus className="size-4" />
                <span>Create Classroom</span>
              </Button>
            )}
          </div>
        </div>

        {/* Executive Stats Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl glass-card flex items-center justify-between gap-4 hover:scale-[1.02] transition-all duration-300">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {isStudent ? "Enrolled Subjects" : "Managed Batches"}
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
              {isStudent ? <GraduationCap className="size-5.5" /> : <FileCheck2 className="size-5.5" />}
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20 max-w-md">
            {errorMsg}
          </div>
        )}

        {/* Student Academic Progress & Performance Summary Widget */}
        {isStudent && analytics && analytics.totalAssigned > 0 && (
          <div className="p-6 rounded-3xl glass-card border border-border/80 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex flex-col gap-2 max-w-md w-full">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-indigo-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Continuous Assessment Tracker
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-foreground tracking-tight">
                {analytics.completedApproved} of {analytics.totalAssigned} Lab Practicals Completed
              </h3>
              {/* Visual Progress Bar */}
              <div className="w-full bg-muted/60 h-2.5 rounded-full overflow-hidden border border-border/40">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((analytics.completedApproved / analytics.totalAssigned) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
              <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {analytics.cumulativeAverageScore}%
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                  Avg. Score
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
                  {analytics.submittedPending}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                  In Review
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                  {analytics.notStarted}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                  Pending
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

        {/* Classrooms Grid (Elevated Apple-Style Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classrooms && classrooms.length > 0 ? (
            classrooms.map((room) => (
              <div
                key={room.id}
                className="group relative p-6 rounded-2xl glass-card hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between h-[210px]"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-muted/80 text-foreground border border-border uppercase tracking-wider">
                      {room.subject}
                    </span>
                    {!isStudent && (
                      <span className="text-[11px] font-mono font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">
                        Code: {room.joinCode}
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-xl mt-3.5 tracking-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                    {room.name}
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground mt-1">
                    {room.department} • {room.semester}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-4 mt-4">
                  <span className="text-xs font-medium text-muted-foreground">
                    Division {room.division}
                  </span>
                  <Button
                    asChild
                    size="sm"
                    className="gap-1.5 text-xs font-semibold rounded-xl active:scale-95 transition-all duration-150 cursor-pointer"
                  >
                    <Link href={`/classrooms/${room.id}`}>
                      <span>View Workspace</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))
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
