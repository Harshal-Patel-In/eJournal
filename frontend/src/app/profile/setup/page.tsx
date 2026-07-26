/**
 * Profile Setup Wizard.
 *
 * Enforces role-specific profiles. Profile complete locks dashboard entry.
 * RULE-AUTH06: redirect to profile setup if incomplete.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const profileSchema = zod.object({
  name: zod.string().min(2, "Name must be at least 2 characters"),
  department: zod.string().min(2, "Department must be at least 2 characters"),
  semester: zod.string().optional(),
  division: zod.string().optional(),
  enrollmentNumber: zod.string().optional(),
  facultyId: zod.string().optional(),
  designation: zod.string().optional(),
  college: zod.string().min(2, "College must be at least 2 characters"),
  university: zod.string().min(2, "University must be at least 2 characters"),
});

type ProfileFields = zod.infer<typeof profileSchema>;

export default function ProfileSetupPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch current user details
  const { data: user, isLoading, error } = useQuery<any>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile"),
    retry: false,
  });

  // Redirect to login if unauthenticated (handles side-effect outside render phase)
  useEffect(() => {
    if (error || (!isLoading && !user)) {
      router.push("/auth/login");
    }
  }, [error, user, isLoading, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFields>({
    resolver: zodResolver(profileSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: ProfileFields) => api.put("/profile", data),
    onSuccess: () => {
      router.push("/dashboard");
      router.refresh();
    },
    onError: (error: any) => {
      setErrorMsg(error.message || "Failed to update profile details");
    },
  });

  const onSubmit = (data: ProfileFields) => {
    setErrorMsg(null);
    // Custom role-based validation before submit
    if (user?.role === "student") {
      if (!data.semester || !data.division || !data.enrollmentNumber) {
        setErrorMsg("All student profile fields are mandatory");
        return;
      }
    } else if (user?.role === "teacher") {
      if (!data.facultyId || !data.designation) {
        setErrorMsg("All teacher profile fields are mandatory");
        return;
      }
    }
    mutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">Loading setup profile parameters...</p>
      </div>
    );
  }

  if (error || !user) {
    return null;
  }

  const isStudent = user.role === "student";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-[500px] p-8 rounded-2xl border border-border bg-card shadow-sm flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl shadow-sm mb-2">
            eJ
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Setup Profile</h2>
          <p className="text-sm text-muted-foreground">
            Complete your academic information as a{" "}
            <span className="font-semibold text-foreground capitalize">{user.role}</span>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20">
              {errorMsg}
            </div>
          )}

          {/* Common fields */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Full Name</label>
            <input
              type="text"
              placeholder="e.g. John Doe"
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              {...register("name")}
            />
            {errors.name && <span className="text-xs text-destructive">{errors.name.message}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Department</label>
            <input
              type="text"
              placeholder="e.g. Computer Engineering"
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              {...register("department")}
            />
            {errors.department && (
              <span className="text-xs text-destructive">{errors.department.message}</span>
            )}
          </div>

          {/* Student specific fields */}
          {isStudent && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Semester</label>
                <input
                  type="text"
                  placeholder="e.g. Semester V"
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...register("semester")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Division</label>
                <input
                  type="text"
                  placeholder="e.g. Division A"
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...register("division")}
                />
              </div>
            </div>
          )}

          {isStudent && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Enrollment Number</label>
              <input
                type="text"
                placeholder="e.g. EN100234"
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                {...register("enrollmentNumber")}
              />
            </div>
          )}

          {/* Teacher specific fields */}
          {!isStudent && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Faculty ID</label>
                <input
                  type="text"
                  placeholder="e.g. FT1029"
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...register("facultyId")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Assistant Professor"
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...register("designation")}
                />
              </div>
            </div>
          )}

          {/* Institutional fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">College</label>
              <input
                type="text"
                placeholder="e.g. Engineering College"
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                {...register("college")}
              />
              {errors.college && (
                <span className="text-xs text-destructive">{errors.college.message}</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">University</label>
              <input
                type="text"
                placeholder="e.g. Technical University"
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                {...register("university")}
              />
              {errors.university && (
                <span className="text-xs text-destructive">{errors.university.message}</span>
              )}
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full mt-4" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving Profile..." : "Save Profile & Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
