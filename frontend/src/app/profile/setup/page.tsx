/**
 * Profile Setup Wizard.
 *
 * Enforces role-specific profiles with strict academic formatting and validation.
 * RULE-AUTH06: redirect to profile setup if incomplete.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
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
  }, [enrollmentValue]);

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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse text-sm">Loading setup profile parameters...</p>
      </div>
    );
  }

  if (error || !user) {
    return null;
  }

  const isStudent = user.role === "student";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute size-[500px] rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[540px] p-8 rounded-3xl glass-card flex flex-col gap-6 relative transition-all duration-300">
        {/* Header */}
        <div className="flex flex-col items-center gap-1 text-center">
          <img
            src="/logo.png"
            alt="eJournal Logo"
            className="h-16 w-auto object-contain mb-2"
          />
          <h2 className="text-2xl font-bold tracking-tight">Setup Profile</h2>
          <p className="text-sm text-muted-foreground">
            Complete your academic information as a{" "}
            <span className="font-semibold text-foreground capitalize">{user.role}</span>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold border border-destructive/20 flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Full Name</label>
            <input
              type="text"
              placeholder="e.g. John Doe"
              className="h-10 rounded-2xl border border-input bg-card px-3.5 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              {...register("name")}
            />
            {errors.name && <span className="text-xs text-destructive">{errors.name.message}</span>}
          </div>

          {/* Department (Dropdown with all CHARUSAT departments) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Academic Department</label>
            <CustomSelect
              value={departmentValue || ""}
              onChange={(val) => setValue("department", val, { shouldValidate: true })}
              options={CHARUSAT_DEPARTMENTS}
              placeholder="Select Academic Department"
              className="w-full text-xs"
            />
            {errors.department && (
              <span className="text-xs text-destructive">{errors.department.message}</span>
            )}
          </div>

          {/* Student-Specific Academic Fields */}
          {isStudent && (
            <>
              {/* Semester & Division */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Semester</label>
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
                  <label className="text-xs font-semibold text-muted-foreground">Division (Numeric Only)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 1, 2, 3"
                    value={divisionValue}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, "");
                      setValue("division", digits, { shouldValidate: true });
                    }}
                    className="h-10 rounded-2xl border border-input bg-card px-3.5 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
                  />
                  {errors.division && (
                    <span className="text-xs text-destructive">{errors.division.message}</span>
                  )}
                </div>
              </div>

              {/* Enrollment Number & Academic Batch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground">Enrollment Number</label>
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
                      onChange={(e) => {
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
                      className={`w-full h-10 rounded-2xl border bg-card px-3.5 pr-8 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 uppercase font-mono font-semibold transition-colors ${
                        enrollmentError
                          ? "border-destructive text-destructive focus-visible:ring-destructive"
                          : isEnrollmentAvailable
                          ? "border-emerald-500/50 text-emerald-600 focus-visible:ring-emerald-500"
                          : "border-input text-foreground focus-visible:ring-primary"
                      }`}
                    />
                    {isEnrollmentAvailable && !enrollmentError && (
                      <CheckCircle2 className="size-4 text-emerald-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    )}
                    {enrollmentError && (
                      <AlertCircle className="size-4 text-destructive absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    )}
                  </div>
                  {enrollmentError ? (
                    <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                      <ShieldAlert className="size-3 shrink-0" />
                      {enrollmentError}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Uppercase alphanumeric only (no spaces)</span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Academic Batch</label>
                  <input
                    type="text"
                    placeholder="e.g. A1, B2"
                    value={batchValue}
                    onChange={(e) => {
                      const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                      setValue("batch", clean, { shouldValidate: true });
                    }}
                    className="h-10 rounded-2xl border border-input bg-card px-3.5 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary uppercase font-mono font-semibold"
                  />
                  <span className="text-[10px] text-muted-foreground">Uppercase alphanumeric only (e.g. A1)</span>
                </div>
              </div>
            </>
          )}

          {/* Teacher-Specific Fields */}
          {!isStudent && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Faculty ID</label>
                <input
                  type="text"
                  placeholder="e.g. FT1029"
                  className="h-10 rounded-2xl border border-input bg-card px-3.5 py-2 text-xs uppercase font-mono font-semibold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  {...register("facultyId")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Assistant Professor"
                  className="h-10 rounded-2xl border border-input bg-card px-3.5 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  {...register("designation")}
                />
              </div>
            </div>
          )}

          {/* Constituent Institute (Dropdown with all 9 CHARUSAT Institutes) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Constituent Institute (College)</label>
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
            <label className="text-xs font-semibold text-muted-foreground">University</label>
            <input
              type="text"
              readOnly
              value={CHARUSAT_UNIVERSITY_NAME}
              className="h-10 rounded-2xl border border-border/80 bg-muted/40 px-3.5 py-2 text-xs text-muted-foreground select-none cursor-not-allowed font-medium"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full mt-4 rounded-2xl font-bold cursor-pointer transition-all"
            disabled={mutation.isPending || isCheckingEnrollment || !!enrollmentError}
          >
            {mutation.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Saving Profile...
              </span>
            ) : (
              "Save Profile & Continue"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
