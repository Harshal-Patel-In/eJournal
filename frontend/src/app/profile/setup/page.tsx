/**
 * Profile Setup Wizard — Almanac Archival Monograph.
 *
 * Enforces role-specific academic profiles with strict institutional formatting,
 * tabular monospace enrollment codes, and crisp paper card styling.
 * RULE-AUTH06: redirect to profile setup if incomplete.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, Lock, ShieldAlert } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import {
  CHARUSAT_COLLEGES,
  CHARUSAT_DEPARTMENTS,
  SEMESTER_OPTIONS,
  CHARUSAT_UNIVERSITY_NAME,
} from "@/lib/academic-constants";

const profileSchema = zod.object({
  name: zod.string().min(2, "Name must be at least 2 characters"),
  department: zod.string().min(2, "Please select an academic department"),
  semester: zod.string().optional(),
  division: zod.string().optional(),
  batch: zod.string().optional(),
  enrollmentNumber: zod.string().optional(),
  facultyId: zod.string().optional(),
  designation: zod.string().optional(),
  college: zod.string().min(2, "Please select a constituent institute"),
  university: zod.string().min(2, "University is required"),
});

type ProfileFields = zod.infer<typeof profileSchema>;

export default function ProfileSetupPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Enrollment duplicate validation states
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);
  const [isCheckingEnrollment, setIsCheckingEnrollment] = useState(false);
  const [isEnrollmentAvailable, setIsEnrollmentAvailable] = useState<boolean | null>(null);
  const [isEnrollmentLocked, setIsEnrollmentLocked] = useState(false);

  // Fetch current user details
  const { data: user, isLoading, error } = useQuery<any>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile"),
    retry: false,
  });

  // If profile is already marked complete, advance to dashboard
  useEffect(() => {
    if (user?.is_profile_complete) {
      if (user?.access_token && typeof document !== "undefined") {
        const isHttps = window.location.protocol === "https:";
        document.cookie = `access_token=${user.access_token}; path=/; max-age=1800; SameSite=Lax; ${isHttps ? "Secure;" : ""}`;
      }
      router.push("/dashboard");
      router.refresh();
    }
  }, [user, router]);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (error || (!isLoading && !user)) {
      router.push("/auth/login");
    }
  }, [error, user, isLoading, router]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProfileFields>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      university: CHARUSAT_UNIVERSITY_NAME,
      department: "",
      semester: "",
      college: "",
    },
  });

  // Synchronize and pre-populate profile form with admin-provisioned data
  useEffect(() => {
    if (user) {
      const existingEnrollment = user.profile?.enrollmentNumber || "";
      if (existingEnrollment) {
        setIsEnrollmentLocked(true);
      }
      reset({
        name: user.profile?.name || user.name || "",
        department: user.profile?.department || "",
        semester: user.profile?.semester ? String(user.profile.semester) : "",
        division: user.profile?.division || "",
        batch: user.profile?.batch || "",
        enrollmentNumber: existingEnrollment,
        facultyId: user.profile?.facultyId || "",
        designation: user.profile?.designation || "",
        college: user.profile?.college || "",
        university: user.profile?.university || CHARUSAT_UNIVERSITY_NAME,
      });
    }
  }, [user, reset]);

  const departmentValue = watch("department");
  const semesterValue = watch("semester");
  const collegeValue = watch("college");
  const enrollmentValue = watch("enrollmentNumber") || "";
  const divisionValue = watch("division") || "";
  const batchValue = watch("batch") || "";

  // Duplicate enrollment number checker with debounce
  useEffect(() => {
    if (!enrollmentValue || enrollmentValue.length < 3) {
      setIsEnrollmentAvailable(null);
      setEnrollmentError(null);
      return;
    }

    // Bypass check if enrollment matches student's own pre-allocated institutional number
    if (user?.profile?.enrollmentNumber && enrollmentValue.toUpperCase() === user.profile.enrollmentNumber.toUpperCase()) {
      setIsEnrollmentAvailable(true);
      setEnrollmentError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingEnrollment(true);
      try {
        const res = await api.get<any>(`/profile/check-enrollment?enrollmentNumber=${encodeURIComponent(enrollmentValue)}`);
        if (res && res.isAvailable === false) {
          setEnrollmentError("This enrollment number is already registered by another student.");
          setIsEnrollmentAvailable(false);
        } else {
          setEnrollmentError(null);
          setIsEnrollmentAvailable(true);
        }
      } catch {
        // Fallback on network hiccups
      } finally {
        setIsCheckingEnrollment(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [enrollmentValue, user]);

  const mutation = useMutation({
    mutationFn: (data: ProfileFields) => api.put<any>("/profile", data),
    onSuccess: (res: any) => {
      if (res?.access_token && typeof document !== "undefined") {
        const isHttps = window.location.protocol === "https:";
        document.cookie = `access_token=${res.access_token}; path=/; max-age=1800; SameSite=Lax; ${isHttps ? "Secure;" : ""}`;
      }
      router.push("/dashboard");
      router.refresh();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to update profile details");
    },
  });

  const onSubmit = (data: ProfileFields) => {
    setErrorMsg(null);
    if (enrollmentError) {
      return;
    }

    // Role-based mandatory checks
    if (user?.role === "student") {
      if (!data.department || !data.semester || !data.division || !data.enrollmentNumber || !data.college) {
        setErrorMsg("All student academic profile fields are mandatory.");
        return;
      }
    } else if (user?.role === "teacher") {
      if (!data.department || !data.facultyId || !data.designation || !data.college) {
        setErrorMsg("All teacher profile fields are mandatory.");
        return;
      }
    }
    mutation.mutate(data);
  };

  if (isLoading) {
    return (
      <AppLoadingScreen
        title="Loading Profile Setup..."
        subtitle="Verifying institutional registry and user roles..."
      />
    );
  }

  if (error || !user) {
    return null;
  }

  const isStudent = user.role === "student";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-background relative select-none">
      <div className="w-full max-w-[540px] p-6 sm:p-8 rounded-2xl bg-card text-card-foreground border border-border/80 shadow-lg flex flex-col gap-5 relative">
        {/* Header */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <img
            src="/logo.png"
            alt="eJournal Logo"
            className="h-12 w-auto object-contain mb-1"
          />
          <h2 className="text-xl font-bold tracking-tight text-foreground font-serif">Setup profile</h2>
          <p className="text-xs text-muted-foreground">
            Complete your academic information as a{" "}
            <span className="font-semibold text-foreground capitalize">{user.role}</span>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {errorMsg && (
            <div className="p-2.5 rounded-md bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20 flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Full name</label>
            <input
              type="text"
              placeholder="e.g. John Doe"
              className="h-10 rounded-xl border border-input bg-muted/40 focus:bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
              {...register("name")}
            />
            {errors.name && (
              <span className="text-xs text-destructive">{errors.name.message}</span>
            )}
          </div>

          {/* Department Dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Academic department</label>
            <CustomSelect
              value={departmentValue || ""}
              onChange={(val) => setValue("department", val, { shouldValidate: true })}
              options={CHARUSAT_DEPARTMENTS}
              placeholder="Select Department"
              className="w-full text-xs"
            />
            {errors.department && (
              <span className="text-xs text-destructive">{errors.department.message}</span>
            )}
          </div>

          {/* Student-Specific Fields */}
          {isStudent && (
            <>
              {/* Semester & Division */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Current semester</label>
                  <CustomSelect
                    value={semesterValue || ""}
                    onChange={(val) => setValue("semester", val, { shouldValidate: true })}
                    options={SEMESTER_OPTIONS}
                    placeholder="Select Semester"
                    className="w-full text-xs"
                  />
                  {errors.semester && (
                    <span className="text-xs text-destructive">{errors.semester.message}</span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Class division</label>
                  <input
                    type="text"
                    placeholder="e.g. 5CE-IT, D1"
                    value={divisionValue}
                    onChange={(e) => {
                      const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
                      setValue("division", clean, { shouldValidate: true });
                    }}
                    className="h-10 rounded-xl border border-input bg-muted/40 focus:bg-background px-3.5 py-2 text-xs text-foreground uppercase font-mono font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                  />
                  {errors.division && (
                    <span className="text-xs text-destructive">{errors.division.message}</span>
                  )}
                </div>
              </div>

              {/* Enrollment Number & Academic Batch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Enrollment number</label>
                    {isCheckingEnrollment && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Loader2 className="size-3 animate-spin text-primary" />
                        Checking...
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. 24CS064"
                      value={enrollmentValue}
                      readOnly={isEnrollmentLocked}
                      onChange={(e) => {
                        if (isEnrollmentLocked) return;
                        const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                        setValue("enrollmentNumber", clean, { shouldValidate: true });
                        setIsEnrollmentAvailable(null);
                        if (!clean) {
                          setEnrollmentError(null);
                        } else if (clean.length < 3) {
                          setEnrollmentError("Enrollment number must be at least 3 characters");
                        } else {
                          setEnrollmentError(null);
                        }
                      }}
                      className={`w-full h-10 rounded-xl border px-3.5 pr-8 py-2 text-xs uppercase font-mono font-medium transition-colors ${
                        isEnrollmentLocked
                          ? "bg-muted/70 border-border text-muted-foreground cursor-not-allowed select-none"
                          : enrollmentError
                          ? "bg-background border-destructive text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                          : isEnrollmentAvailable
                          ? "bg-background border-emerald-500/50 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                          : "bg-muted/40 focus:bg-background border-input text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                      }`}
                    />
                    {isEnrollmentLocked ? (
                      <Lock className="size-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    ) : isEnrollmentAvailable && !enrollmentError ? (
                      <CheckCircle2 className="size-3.5 text-emerald-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    ) : enrollmentError ? (
                      <AlertCircle className="size-3.5 text-destructive absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    ) : null}
                  </div>
                  {isEnrollmentLocked ? (
                    <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                      <Lock className="size-2.5 shrink-0 text-primary" />
                      Assigned by university administration (Read-only)
                    </span>
                  ) : enrollmentError ? (
                    <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                      <ShieldAlert className="size-3 shrink-0" />
                      {enrollmentError}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Uppercase alphanumeric only (no spaces)</span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Academic batch</label>
                  <input
                    type="text"
                    placeholder="e.g. A1, B2"
                    value={batchValue}
                    onChange={(e) => {
                      const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                      setValue("batch", clean, { shouldValidate: true });
                    }}
                    className="h-10 rounded-xl border border-input bg-muted/40 focus:bg-background px-3.5 py-2 text-xs text-foreground uppercase font-mono font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                  />
                  <span className="text-[10px] text-muted-foreground">Uppercase alphanumeric only (e.g. A1)</span>
                </div>
              </div>
            </>
          )}

          {/* Teacher-Specific Fields */}
          {!isStudent && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Faculty ID</label>
                <input
                  type="text"
                  placeholder="e.g. FT1029"
                  className="h-10 rounded-xl border border-input bg-muted/40 focus:bg-background px-3.5 py-2 text-xs uppercase font-mono font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                  {...register("facultyId")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Assistant Professor"
                  className="h-10 rounded-xl border border-input bg-muted/40 focus:bg-background px-3.5 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                  {...register("designation")}
                />
              </div>
            </div>
          )}

          {/* Constituent Institute (Dropdown with all 9 CHARUSAT Institutes) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Constituent institute (College)</label>
            <CustomSelect
              value={collegeValue || ""}
              onChange={(val) => setValue("college", val, { shouldValidate: true })}
              options={CHARUSAT_COLLEGES}
              placeholder="Select Constituent Institute"
              className="w-full text-xs"
            />
            {errors.college && (
              <span className="text-xs text-destructive">{errors.college.message}</span>
            )}
          </div>

          {/* University (Locked to CHARUSAT) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">University</label>
            <input
              type="text"
              readOnly
              value={CHARUSAT_UNIVERSITY_NAME}
              className="h-10 rounded-xl border border-border bg-muted/60 px-3.5 py-2 text-xs text-muted-foreground select-none cursor-not-allowed font-medium"
            />
          </div>

          <Button
            type="submit"
            size="default"
            className="w-full mt-3 h-10 rounded-xl font-semibold text-xs glass-btn-indigo-solid active:scale-[0.98] transition-all cursor-pointer shadow-xs"
            disabled={mutation.isPending || isCheckingEnrollment || !!enrollmentError}
          >
            {mutation.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" />
                Saving profile...
              </span>
            ) : (
              "Save profile & continue"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
