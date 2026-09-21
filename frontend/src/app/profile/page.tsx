"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  User,
  GraduationCap,
  Building2,
  BookOpen,
  CheckCircle2,
  Save,
  Loader2,
  Sparkles,
  ShieldCheck,
  Mail,
  Award,
  IdCard,
} from "lucide-react";

import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const studentProfileSchema = zod.object({
  name: zod.string().min(2, "Full Name must be at least 2 characters"),
  enrollmentNumber: zod.string().min(2, "Enrollment / Roll Number is required"),
  department: zod.string().min(2, "Department is required"),
  semester: zod.string().min(1, "Semester is required"),
  division: zod.string().min(1, "Division is required"),
  batch: zod.string().optional(),
  college: zod.string().min(2, "College / Institute is required"),
  university: zod.string().min(2, "University is required"),
});

const teacherProfileSchema = zod.object({
  name: zod.string().min(2, "Full Name must be at least 2 characters"),
  facultyId: zod.string().min(2, "Faculty / Employee ID is required"),
  designation: zod.string().min(2, "Designation is required"),
  department: zod.string().min(2, "Department is required"),
  college: zod.string().min(2, "College / Institute is required"),
  university: zod.string().min(2, "University is required"),
});

export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"general" | "preview">("general");

  // 1. Fetch current profile
  const { data: user, isLoading, error } = useQuery<any>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile"),
    retry: false,
  });

  // 2. Fetch user classrooms for statistics
  const { data: classrooms } = useQuery<any[]>({
    queryKey: ["classrooms"],
    queryFn: () => api.get("/classrooms"),
    enabled: !!user,
  });

  // 3. Fetch journals for statistics
  const { data: journals } = useQuery<any[]>({
    queryKey: ["student-journals"],
    queryFn: () => api.get("/journals"),
    enabled: user?.role === "student",
  });

  useEffect(() => {
    if (error) {
      router.push("/auth/login");
    }
  }, [error, router]);

  const isStudent = user?.role === "student";
  const schema = isStudent ? studentProfileSchema : teacherProfileSchema;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<any>({
    resolver: zodResolver(schema),
    values: {
      name: user?.profile?.name || "",
      enrollmentNumber: user?.profile?.enrollmentNumber || "",
      department: user?.profile?.department || "",
      semester: user?.profile?.semester || "IV",
      division: user?.profile?.division || "1",
      batch: user?.profile?.batch || "Batch A",
      facultyId: user?.profile?.facultyId || "",
      designation: user?.profile?.designation || "Assistant Professor",
      college: user?.profile?.college || "",
      university: user?.profile?.university || "",
    },
  });

  // Watch fields for live preview card
  const watchedValues = watch();

  // Profile update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put("/profile", data),
    onSuccess: (updatedUser: any) => {
      if (updatedUser?.access_token && typeof document !== "undefined") {
        const isHttps = window.location.protocol === "https:";
        document.cookie = `access_token=${updatedUser.access_token}; path=/; max-age=1800; SameSite=Lax; ${isHttps ? "Secure;" : ""}`;
      }
      queryClient.setQueryData(["profile"], updatedUser);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated successfully! Document metadata synchronized.");
      reset(watchedValues);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update profile details");
    },
  });

  const onSubmit = (data: any) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-semibold">Loading academic profile...</p>
      </div>
    );
  }

  const initials = user?.profile?.name
    ? user.profile.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "U";

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

      {/* 2. Floating Header Bar */}
      <header className="fixed top-4 left-16 sm:left-24 md:left-32 right-4 sm:right-8 md:right-16 z-40 flex items-center justify-between px-5 py-2.5 bg-gradient-to-b from-white/80 via-white/65 to-white/50 dark:from-zinc-900/85 dark:via-zinc-900/75 dark:to-zinc-950/70 backdrop-blur-2xl backdrop-saturate-180 border border-white/80 dark:border-white/15 ring-1 ring-black/5 dark:ring-white/10 shadow-xl rounded-2xl select-none transition-all duration-300">
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
          <span className="font-bold text-base tracking-tight">Academic Profile Hub</span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
            isStudent
              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          }`}>
            {isStudent ? "Student Profile" : "Faculty Profile"}
          </span>
        </div>
      </header>

      {/* Main Profile Canvas */}
      <main className="max-w-6xl w-full mx-auto p-6 md:p-8 pt-24 md:pt-24 flex flex-col gap-6 relative z-10">
        
        {/* Top Header Card */}
        <div className="p-6 md:p-8 rounded-3xl glass-card relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-border/80 shadow-md">
          {/* Subtle Ambient Background Gradient */}
          <div className="absolute top-0 right-1/4 w-96 h-32 bg-gradient-to-r from-primary/5 via-accent/5 to-emerald-500/5 blur-3xl pointer-events-none -z-10" />

          <div className="flex items-center gap-5">
            <div className={`size-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-xl ring-4 ring-black/5 dark:ring-white/10 shrink-0 transition-transform hover:scale-105 duration-200 ${
              isStudent
                ? "bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 shadow-indigo-500/20"
                : "bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 shadow-emerald-500/20"
            }`}>
              {initials}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                  {user?.profile?.name || "Academic Profile"}
                </h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="size-3" />
                  Verified {isStudent ? "Student" : "Faculty"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap font-medium">
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5 text-muted-foreground/70" />
                  {user?.email}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-muted-foreground/70" />
                  {user?.profile?.college || "Institute Not Configured"}
                </span>
                {user?.profile?.enrollmentNumber && (
                  <>
                    <span>•</span>
                    <span className="font-mono font-bold text-foreground">
                      {user.profile.enrollmentNumber}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Academic Stats */}
          <div className="flex items-center gap-3 self-stretch md:self-auto shrink-0">
            <div className="flex-1 md:flex-none p-3.5 rounded-2xl glass-card border border-border/70 text-center min-w-[110px] shadow-2xs">
              <div className="text-xl font-black text-foreground">{classrooms?.length || 0}</div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                {classrooms?.length === 1 ? "Classroom" : "Classrooms"}
              </div>
            </div>
            {isStudent && (
              <div className="flex-1 md:flex-none p-3.5 rounded-2xl glass-card border border-border/70 text-center min-w-[110px] shadow-2xs">
                <div className="text-xl font-black text-foreground">{journals?.length || 0}</div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                  {journals?.length === 1 ? "Journal" : "Journals"}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tab Switcher for Details vs Document Live Preview */}
        <div className="flex items-center p-1.5 glass-pill rounded-2xl max-w-fit gap-1 select-none border border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === "general"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <IdCard className="size-3.5 text-primary" />
            <span>Academic Parameters</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === "preview"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Award className="size-3.5 text-amber-500" />
            <span>Official Report Preview</span>
          </button>
        </div>

        {/* =========================================================================
            TAB 1: UNIFIED MASTER ACADEMIC PROFILE CANVAS
            ========================================================================= */}
        {activeTab === "general" && (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 pb-12">
            <div className="p-6 md:p-8 rounded-3xl glass-card border border-border/80 shadow-md flex flex-col gap-8">
              
              {/* Card Header with Inline Action Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                    <IdCard className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-foreground tracking-tight">
                      {isStudent ? "Student Academic Parameters" : "Faculty Appointment Credentials"}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isStudent
                        ? "Institutional identifiers and cohort details printed across your laboratory journals and certificates."
                        : "Official appointment credentials, academic designation, and institutional affiliation."}
                    </p>
                  </div>
                </div>

                {/* Quick Save / Discard Controls in Header */}
                <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                  {isDirty && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => reset()}
                      disabled={updateMutation.isPending}
                      className="rounded-xl h-9 px-3.5 text-xs font-semibold cursor-pointer border-border/80"
                    >
                      Discard
                    </Button>
                  )}

                  <Button
                    type="submit"
                    size="sm"
                    disabled={!isDirty || updateMutation.isPending}
                    className={`gap-1.5 rounded-xl h-9 px-4 text-xs font-bold transition-all cursor-pointer ${
                      isDirty
                        ? "shadow-md shadow-primary/25 ring-2 ring-primary/30"
                        : "opacity-60"
                    }`}
                  >
                    {updateMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                    <span>Save Changes</span>
                  </Button>
                </div>
              </div>

              {/* SECTION 1: LEGAL IDENTITY & APPOINTMENT */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  <User className="size-3.5 text-primary" />
                  <span>Personal Identity & Credentials</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Full Legal Name */}
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="font-bold text-foreground flex items-center gap-1.5">
                      <span>Full Legal Name</span>
                    </label>
                    <input
                      {...register("name")}
                      placeholder="e.g. Harshal Patel"
                      className="w-full h-10 px-3.5 rounded-xl border border-border/80 bg-background/80 hover:border-border focus:bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-xs font-medium placeholder:text-muted-foreground/50 shadow-2xs"
                    />
                    {errors.name && (
                      <span className="text-[11px] text-destructive font-medium">{String(errors.name.message)}</span>
                    )}
                  </div>

                  {isStudent ? (
                    /* Enrollment / Roll Number */
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label className="font-bold text-foreground flex items-center gap-1.5">
                        <Award className="size-3 text-muted-foreground" />
                        <span>Enrollment / Roll Number</span>
                      </label>
                      <input
                        {...register("enrollmentNumber")}
                        placeholder="e.g. 24CS065"
                        className="w-full h-10 px-3.5 rounded-xl border border-border/80 bg-background/80 hover:border-border focus:bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-xs font-semibold placeholder:text-muted-foreground/50 shadow-2xs"
                      />
                      {errors.enrollmentNumber && (
                        <span className="text-[11px] text-destructive font-medium">{String(errors.enrollmentNumber.message)}</span>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Faculty ID */}
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-foreground flex items-center gap-1.5">
                          <ShieldCheck className="size-3 text-muted-foreground" />
                          <span>Faculty / Employee ID</span>
                        </label>
                        <input
                          {...register("facultyId")}
                          placeholder="e.g. FAC-2024-09"
                          className="w-full h-10 px-3.5 rounded-xl border border-border/80 bg-background/80 hover:border-border focus:bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-xs font-semibold placeholder:text-muted-foreground/50 shadow-2xs"
                        />
                        {errors.facultyId && (
                          <span className="text-[11px] text-destructive font-medium">{String(errors.facultyId.message)}</span>
                        )}
                      </div>

                      {/* Academic Designation */}
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-foreground flex items-center gap-1.5">
                          <Award className="size-3 text-muted-foreground" />
                          <span>Academic Designation</span>
                        </label>
                        <input
                          {...register("designation")}
                          placeholder="e.g. Assistant Professor, HoD"
                          className="w-full h-10 px-3.5 rounded-xl border border-border/80 bg-background/80 hover:border-border focus:bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-xs font-medium placeholder:text-muted-foreground/50 shadow-2xs"
                        />
                        {errors.designation && (
                          <span className="text-[11px] text-destructive font-medium">{String(errors.designation.message)}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* SECTION DIVIDER */}
              <div className="h-px bg-border/60" />

              {/* SECTION 2: ACADEMIC DEPARTMENT & COHORT */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  <GraduationCap className="size-3.5 text-indigo-500" />
                  <span>{isStudent ? "Academic Stream & Laboratory Cohort" : "Academic Department"}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  {/* Department */}
                  <div className={`flex flex-col gap-1.5 ${isStudent ? "sm:col-span-3" : "sm:col-span-3"}`}>
                    <label className="font-bold text-foreground flex items-center gap-1.5">
                      <BookOpen className="size-3 text-muted-foreground" />
                      <span>Department / Academic Program</span>
                    </label>
                    <input
                      {...register("department")}
                      placeholder="e.g. Computer Science & Engineering"
                      className="w-full h-10 px-3.5 rounded-xl border border-border/80 bg-background/80 hover:border-border focus:bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-xs font-medium placeholder:text-muted-foreground/50 shadow-2xs"
                    />
                    {errors.department && (
                      <span className="text-[11px] text-destructive font-medium">{String(errors.department.message)}</span>
                    )}
                  </div>

                  {isStudent && (
                    <>
                      {/* Semester */}
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-foreground flex items-center gap-1.5">
                          <span>Current Semester</span>
                        </label>
                        <input
                          {...register("semester")}
                          placeholder="e.g. V, 5"
                          className="w-full h-10 px-3.5 rounded-xl border border-border/80 bg-background/80 hover:border-border focus:bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-xs font-medium placeholder:text-muted-foreground/50 shadow-2xs"
                        />
                        {errors.semester && (
                          <span className="text-[11px] text-destructive font-medium">{String(errors.semester.message)}</span>
                        )}
                      </div>

                      {/* Class Division */}
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-foreground flex items-center gap-1.5">
                          <span>Class Division</span>
                        </label>
                        <input
                          {...register("division")}
                          placeholder="e.g. 1, Div A"
                          className="w-full h-10 px-3.5 rounded-xl border border-border/80 bg-background/80 hover:border-border focus:bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-xs font-medium placeholder:text-muted-foreground/50 shadow-2xs"
                        />
                        {errors.division && (
                          <span className="text-[11px] text-destructive font-medium">{String(errors.division.message)}</span>
                        )}
                      </div>

                      {/* Practical Batch */}
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-foreground flex items-center gap-1.5">
                          <span>Practical Batch</span>
                        </label>
                        <input
                          {...register("batch")}
                          placeholder="e.g. Batch A1, B1"
                          className="w-full h-10 px-3.5 rounded-xl border border-border/80 bg-background/80 hover:border-border focus:bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-xs font-medium placeholder:text-muted-foreground/50 shadow-2xs"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* SECTION DIVIDER */}
              <div className="h-px bg-border/60" />

              {/* SECTION 3: INSTITUTIONAL ACCREDITATION & UNIVERSITY */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  <Building2 className="size-3.5 text-emerald-500" />
                  <span>Institutional Accreditation & University Affiliation</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* College / Institute */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-foreground flex items-center gap-1.5">
                      <Building2 className="size-3 text-muted-foreground" />
                      <span>College / Institute Name</span>
                    </label>
                    <input
                      {...register("college")}
                      placeholder="e.g. Chandubhai S. Patel Institute of Technology"
                      className="w-full h-10 px-3.5 rounded-xl border border-border/80 bg-background/80 hover:border-border focus:bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-xs font-medium placeholder:text-muted-foreground/50 shadow-2xs"
                    />
                    {errors.college && (
                      <span className="text-[11px] text-destructive font-medium">{String(errors.college.message)}</span>
                    )}
                  </div>

                  {/* University */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-foreground flex items-center gap-1.5">
                      <Building2 className="size-3 text-muted-foreground" />
                      <span>Affiliated University</span>
                    </label>
                    <input
                      {...register("university")}
                      placeholder="e.g. CHARUSAT University"
                      className="w-full h-10 px-3.5 rounded-xl border border-border/80 bg-background/80 hover:border-border focus:bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-xs font-medium placeholder:text-muted-foreground/50 shadow-2xs"
                    />
                    {errors.university && (
                      <span className="text-[11px] text-destructive font-medium">{String(errors.university.message)}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* CARD FOOTER WITH IN-FLOW SAVE DOCK */}
              <div className="pt-6 border-t border-border/60 flex items-center justify-between gap-4 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground">
                  {isDirty ? (
                    <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                      Unsaved modifications ready to save
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                      All profile parameters synchronized with your institutional records
                    </span>
                  )}
                </span>

                <div className="flex items-center gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => reset()}
                    disabled={!isDirty || updateMutation.isPending}
                    className="rounded-xl h-9 px-4 text-xs font-semibold cursor-pointer border-border/80"
                  >
                    Discard Changes
                  </Button>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={!isDirty || updateMutation.isPending}
                    className={`gap-2 rounded-xl h-9 px-5 text-xs font-bold transition-all cursor-pointer ${
                      isDirty
                        ? "shadow-lg shadow-primary/20 ring-2 ring-primary/30"
                        : "opacity-50"
                    }`}
                  >
                    {updateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    <span>Save Profile Changes</span>
                  </Button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* =========================================================================
            TAB 2: DOCUMENT CREDENTIAL LIVE PREVIEW
            ========================================================================= */}
        {activeTab === "preview" && (
          <div className="p-6 md:p-8 rounded-3xl glass-card flex flex-col gap-6">
            <div className="border-b border-border/60 pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Award className="size-4 text-amber-500" />
                <span>Live Document Credential Preview</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                This shows exactly how your academic identity is formatted on printed Cover Pages, Certificates, and Lab Journals.
              </p>
            </div>

            {/* Candidate Information Box Representation */}
            <div className="w-full max-w-lg mx-auto border-2 border-zinc-800 p-6 rounded-md text-left bg-white text-zinc-950 shadow-xl select-none">
              <div className="text-xs font-black uppercase tracking-wider text-zinc-500 border-b border-zinc-300 pb-2 mb-4">
                {isStudent ? "Candidate Information (Official Record)" : "Faculty In-Charge Evaluation Record"}
              </div>

              <div className="grid grid-cols-2 gap-y-3 text-xs">
                <span className="font-bold text-zinc-600">{isStudent ? "Student Name:" : "Faculty In-Charge:"}</span>
                <strong className="text-zinc-950 font-bold">{watchedValues.name || "Full Name"}</strong>

                <span className="font-bold text-zinc-600">{isStudent ? "Roll / Enrollment No:" : "Faculty ID:"}</span>
                <strong className="text-zinc-950 font-mono font-bold">
                  {isStudent ? watchedValues.enrollmentNumber || "24CS065" : watchedValues.facultyId || "FAC-101"}
                </strong>

                <span className="font-bold text-zinc-600">Department:</span>
                <span className="text-zinc-950 font-medium">{watchedValues.department || "Computer Science"}</span>

                {isStudent ? (
                  <>
                    <span className="font-bold text-zinc-600">Semester & Div:</span>
                    <strong className="text-zinc-950 font-mono font-bold">
                      Sem {watchedValues.semester || "IV"} • {watchedValues.division || "Div 1"}
                    </strong>

                    <span className="font-bold text-zinc-600">Practical Batch:</span>
                    <strong className="text-zinc-950 font-mono font-bold">{watchedValues.batch || "Batch A"}</strong>
                  </>
                ) : (
                  <>
                    <span className="font-bold text-zinc-600">Designation:</span>
                    <strong className="text-zinc-950 font-bold">{watchedValues.designation || "Assistant Professor"}</strong>
                  </>
                )}

                <span className="font-bold text-zinc-600">Institute / College:</span>
                <span className="text-zinc-950 font-medium">{watchedValues.college || "Institute of Technology"}</span>

                <span className="font-bold text-zinc-600">Affiliated University:</span>
                <span className="text-zinc-950 font-medium">{watchedValues.university || "State Technical University"}</span>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-200 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                <span>Verified Status: ACTIVE</span>
                <span>ISO A4 Verified</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
