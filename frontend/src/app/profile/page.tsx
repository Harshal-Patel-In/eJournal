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
        <div className="p-6 md:p-8 rounded-3xl glass-card relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="size-20 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border-2 border-primary/30 flex items-center justify-center text-2xl font-black text-primary shadow-inner shrink-0">
              {initials}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                  {user?.profile?.name || "Academic Profile"}
                </h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="size-3" />
                  Verified
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Mail className="size-3.5 text-muted-foreground/70" />
                  {user?.email}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="size-3.5 text-muted-foreground/70" />
                  {user?.profile?.college || "Institute Not Configured"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Academic Stats */}
          <div className="flex items-center gap-3 self-stretch md:self-auto">
            <div className="flex-1 md:flex-none p-3.5 rounded-2xl bg-background/60 border border-border/70 text-center min-w-[100px]">
              <div className="text-lg font-black text-foreground">{classrooms?.length || 0}</div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Classrooms</div>
            </div>
            {isStudent && (
              <div className="flex-1 md:flex-none p-3.5 rounded-2xl bg-background/60 border border-border/70 text-center min-w-[100px]">
                <div className="text-lg font-black text-foreground">{journals?.length || 0}</div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Journals</div>
              </div>
            )}
          </div>
        </div>

        {/* Tab Switcher for Details vs Document Live Preview */}
        <div className="flex items-center p-1.5 glass-pill rounded-2xl max-w-fit gap-1 select-none">
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
            <span>Academic Metadata</span>
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
            <span>Document Credential Preview</span>
          </button>
        </div>

        {/* =========================================================================
            TAB 1: EDITABLE ACADEMIC PROFILE FORM
            ========================================================================= */}
        {activeTab === "general" && (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
            <div className="p-6 md:p-8 rounded-3xl glass-card flex flex-col gap-6">
              <div className="border-b border-border/60 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {isStudent ? "Student Academic Parameters" : "Faculty Appointment Credentials"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    These credentials automatically print on your cover pages, certificates, and laboratory reports.
                  </p>
                </div>
                {isDirty && (
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20 animate-pulse">
                    ● Unsaved Changes
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                {/* Full Legal Name */}
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="font-bold text-foreground">Full Legal Name</label>
                  <input
                    {...register("name")}
                    placeholder="e.g. Harshal Patel"
                    className="h-10 px-3.5 rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-all text-xs font-medium"
                  />
                  {errors.name && (
                    <span className="text-[11px] text-destructive font-medium">{String(errors.name.message)}</span>
                  )}
                </div>

                {isStudent ? (
                  <>
                    {/* Enrollment / Roll Number */}
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-foreground">Enrollment / Roll Number</label>
                      <input
                        {...register("enrollmentNumber")}
                        placeholder="e.g. 24CS065"
                        className="h-10 px-3.5 rounded-xl border border-border bg-background text-foreground font-mono focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-all text-xs"
                      />
                      {errors.enrollmentNumber && (
                        <span className="text-[11px] text-destructive font-medium">{String(errors.enrollmentNumber.message)}</span>
                      )}
                    </div>

                    {/* Department */}
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-foreground">Department / Major</label>
                      <input
                        {...register("department")}
                        placeholder="e.g. Computer Science & Engineering"
                        className="h-10 px-3.5 rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-all text-xs"
                      />
                      {errors.department && (
                        <span className="text-[11px] text-destructive font-medium">{String(errors.department.message)}</span>
                      )}
                    </div>

                    {/* Semester */}
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-foreground">Current Semester</label>
                      <input
                        {...register("semester")}
                        placeholder="e.g. IV, V, Sem 4"
                        className="h-10 px-3.5 rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-all text-xs"
                      />
                      {errors.semester && (
                        <span className="text-[11px] text-destructive font-medium">{String(errors.semester.message)}</span>
                      )}
                    </div>

                    {/* Division */}
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-foreground">Class Division</label>
                      <input
                        {...register("division")}
                        placeholder="e.g. Div 1, Div A"
                        className="h-10 px-3.5 rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-all text-xs"
                      />
                      {errors.division && (
                        <span className="text-[11px] text-destructive font-medium">{String(errors.division.message)}</span>
                      )}
                    </div>

                    {/* Lab Batch */}
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label className="font-bold text-foreground">Laboratory Practical Batch</label>
                      <input
                        {...register("batch")}
                        placeholder="e.g. Batch A1, Group 2"
                        className="h-10 px-3.5 rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-all text-xs"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Faculty / Employee ID */}
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-foreground">Faculty / Employee ID</label>
                      <input
                        {...register("facultyId")}
                        placeholder="e.g. FAC-2024-09"
                        className="h-10 px-3.5 rounded-xl border border-border bg-background text-foreground font-mono focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-all text-xs"
                      />
                      {errors.facultyId && (
                        <span className="text-[11px] text-destructive font-medium">{String(errors.facultyId.message)}</span>
                      )}
                    </div>

                    {/* Designation */}
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-foreground">Academic Designation</label>
                      <input
                        {...register("designation")}
                        placeholder="e.g. Assistant Professor, HOD"
                        className="h-10 px-3.5 rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-all text-xs"
                      />
                      {errors.designation && (
                        <span className="text-[11px] text-destructive font-medium">{String(errors.designation.message)}</span>
                      )}
                    </div>

                    {/* Department */}
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label className="font-bold text-foreground">Department</label>
                      <input
                        {...register("department")}
                        placeholder="e.g. Computer Engineering & Applied Sciences"
                        className="h-10 px-3.5 rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-all text-xs"
                      />
                      {errors.department && (
                        <span className="text-[11px] text-destructive font-medium">{String(errors.department.message)}</span>
                      )}
                    </div>
                  </>
                )}

                {/* College / Institute */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-foreground">College / Institute Name</label>
                  <input
                    {...register("college")}
                    placeholder="e.g. Institute of Science & Technology"
                    className="h-10 px-3.5 rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-all text-xs"
                  />
                  {errors.college && (
                    <span className="text-[11px] text-destructive font-medium">{String(errors.college.message)}</span>
                  )}
                </div>

                {/* University */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-foreground">Affiliated University</label>
                  <input
                    {...register("university")}
                    placeholder="e.g. State Technological University"
                    className="h-10 px-3.5 rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-all text-xs"
                  />
                  {errors.university && (
                    <span className="text-[11px] text-destructive font-medium">{String(errors.university.message)}</span>
                  )}
                </div>
              </div>

              {/* Form Action Footer */}
              <div className="border-t border-border/60 pt-4 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => reset()}
                  disabled={!isDirty || updateMutation.isPending}
                  className="rounded-xl h-9 px-4 text-xs font-semibold cursor-pointer"
                >
                  Discard Changes
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={!isDirty || updateMutation.isPending}
                  className="gap-2 rounded-xl h-9 px-5 text-xs font-bold shadow-md cursor-pointer"
                >
                  {updateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  <span>Save Profile Changes</span>
                </Button>
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
