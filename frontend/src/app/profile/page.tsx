"use client";

import { useEffect, useState, useMemo } from "react";
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
  Lock,
  Mail,
  Award,
  IdCard,
  FileEdit,
  Bell,
  Trash2,
  Clock,
  ArrowRight,
  AlertCircle,
  Check,
  X,
  ShieldCheck,
} from "lucide-react";

import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import {
  CHARUSAT_COLLEGES,
  CHARUSAT_DEPARTMENTS,
  SEMESTER_OPTIONS,
  CHARUSAT_UNIVERSITY_NAME,
} from "@/lib/academic-constants";
import { formatRelativeTimeIST } from "@/lib/date";

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

  // Correction Request Modal states
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [selectedCorrectionField, setSelectedCorrectionField] = useState<
    "enrollmentNumber" | "name" | "department" | "college"
  >("enrollmentNumber");
  const [correctionRequestedValue, setCorrectionRequestedValue] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");

  // 1. Fetch current profile
  const { data: user, isLoading, error } = useQuery<any>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile"),
    retry: false,
  });

  const isStudent = user?.role === "student";

  // 2. Fetch active change request for students and teachers
  const { data: activeRequest, refetch: refetchActiveRequest } = useQuery<any>({
    queryKey: ["active-profile-change-request"],
    queryFn: () => api.get("/profile/change-request/active"),
    enabled: !!user,
  });

  // 3. Fetch user classrooms for statistics
  const { data: classrooms } = useQuery<any[]>({
    queryKey: ["classrooms"],
    queryFn: () => api.get("/classrooms"),
    enabled: !!user,
  });

  // 4. Fetch journals for statistics
  const { data: journals } = useQuery<any[]>({
    queryKey: ["student-journals"],
    queryFn: () => api.get("/journals"),
    enabled: isStudent,
  });

  useEffect(() => {
    if (error) {
      router.push("/auth/login");
    }
  }, [error, router]);

  const schema = isStudent ? studentProfileSchema : teacherProfileSchema;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<any>({
    resolver: zodResolver(schema),
    values: {
      name: user?.profile?.name || user?.name || "",
      enrollmentNumber: user?.profile?.enrollmentNumber || "",
      department: user?.profile?.department || "",
      semester: user?.profile?.semester ? String(user?.profile?.semester) : "1",
      division: user?.profile?.division || "1",
      batch: user?.profile?.batch || "Batch A",
      facultyId: user?.profile?.facultyId || "",
      designation: user?.profile?.designation || "Assistant Professor",
      college: user?.profile?.college || "",
      university: user?.profile?.university || CHARUSAT_UNIVERSITY_NAME,
    },
  });

  // Watch fields for live preview card and CustomSelect sync
  const watchedValues = watch();
  const watchedSemester = watch("semester");
  const watchedDepartment = watch("department");
  const watchedCollege = watch("college");

  // Profile update mutation (self-editable lifecycle fields)
  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put("/profile", data),
    onSuccess: (updatedUser: any) => {
      if (updatedUser?.access_token && typeof document !== "undefined") {
        const isHttps = window.location.protocol === "https:";
        document.cookie = `access_token=${updatedUser.access_token}; path=/; max-age=1800; SameSite=Lax; ${isHttps ? "Secure;" : ""}`;
      }
      queryClient.setQueryData(["profile"], updatedUser);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile parameters synchronized successfully.");
      reset(watchedValues);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update profile details");
    },
  });

  // Reminder Bump Mutation (24h cooldown)
  const bumpMutation = useMutation({
    mutationFn: (requestId: string) =>
      api.post(`/profile/change-request/${requestId}/bump`, {}),
    onSuccess: () => {
      refetchActiveRequest();
      toast.success("Reminder dispatched to administrator notifications.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send reminder");
    },
  });

  // Discard Change Request Mutation
  const discardMutation = useMutation({
    mutationFn: (requestId: string) =>
      api.delete(`/profile/change-request/${requestId}`),
    onSuccess: () => {
      refetchActiveRequest();
      toast.info("Correction request discarded and withdrawn.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to discard request");
    },
  });

  // Submit Correction Request Mutation
  const submitCorrectionMutation = useMutation({
    mutationFn: (payload: { field: string; requestedValue: string; reason: string }) =>
      api.post("/profile/change-request", payload),
    onSuccess: () => {
      refetchActiveRequest();
      setShowCorrectionModal(false);
      setCorrectionReason("");
      setCorrectionRequestedValue("");
      toast.success("Correction request submitted for administrative review.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit correction request");
    },
  });

  // 24-Hour Cooldown Verification for Reminder Bump
  const canBump = useMemo(() => {
    if (!activeRequest) return false;
    const lastAction = activeRequest.lastBumpedAt || activeRequest.createdAt;
    if (!lastAction) return true;
    const elapsedMs = Date.now() - new Date(lastAction).getTime();
    return elapsedMs >= 24 * 60 * 60 * 1000;
  }, [activeRequest]);

  const remainingCooldownHours = useMemo(() => {
    if (!activeRequest || canBump) return 0;
    const lastAction = activeRequest.lastBumpedAt || activeRequest.createdAt;
    const elapsedMs = Date.now() - new Date(lastAction).getTime();
    const remainingMs = 24 * 60 * 60 * 1000 - elapsedMs;
    return Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
  }, [activeRequest, canBump]);

  const onSubmit = (data: any) => {
    updateMutation.mutate(data);
  };

  const openCorrectionModal = (
    field: "enrollmentNumber" | "name" | "department" | "college"
  ) => {
    setSelectedCorrectionField(field);
    setCorrectionRequestedValue("");
    setCorrectionReason("");
    setShowCorrectionModal(true);
  };

  const handleSubmitCorrection = () => {
    if (!correctionRequestedValue.trim()) {
      toast.error("Please enter or select a desired corrected value.");
      return;
    }
    if (correctionReason.trim().length < 10) {
      toast.error("Please provide a reason of at least 10 characters.");
      return;
    }
    submitCorrectionMutation.mutate({
      field: selectedCorrectionField,
      requestedValue: correctionRequestedValue.trim(),
      reason: correctionReason.trim(),
    });
  };

  if (isLoading) {
    return (
      <AppLoadingScreen
        title="Loading Academic Profile..."
        subtitle="Retrieving user credentials and departmental records..."
      />
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

  const collegeLabel =
    CHARUSAT_COLLEGES.find(
      (c) => c.value === (user?.profile?.college || watchedValues.college)
    )?.label ||
    user?.profile?.college ||
    watchedValues.college;

  const departmentLabel =
    CHARUSAT_DEPARTMENTS.find(
      (d) => d.value === (user?.profile?.department || watchedValues.department)
    )?.label ||
    user?.profile?.department ||
    watchedValues.department;

  const currentFieldValueDisplay =
    selectedCorrectionField === "enrollmentNumber"
      ? user?.profile?.enrollmentNumber || watchedValues.enrollmentNumber
      : selectedCorrectionField === "name"
      ? user?.profile?.name || user?.name || watchedValues.name
      : selectedCorrectionField === "department"
      ? departmentLabel
      : collegeLabel;

  return (
    <div className="min-h-screen bg-textured-workspace text-foreground flex flex-col">
      {/* Grounded Institutional Archival Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 backdrop-blur-xs px-4 sm:px-8 py-3 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            title="Back to dashboard"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-card hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-all active:scale-[0.98]"
          >
            <ArrowLeft className="size-3.5" />
            <span>Dashboard</span>
          </Link>
          <span className="text-muted-foreground/30 font-light select-none">/</span>
          <span className="text-xs font-medium text-foreground">
            Academic profile dossier
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <span className="px-2 py-0.5 rounded text-xs font-medium border border-border bg-muted/40 text-foreground">
            {isStudent ? "Student profile" : "Faculty profile"}
          </span>
        </div>
      </header>

      {/* Main Profile Canvas */}
      <main className="max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8 flex flex-col gap-6 relative z-10">
        {/* Top Header Card */}
        <div className="p-5 sm:p-6 rounded-lg border border-border bg-card shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-md bg-muted text-foreground border border-border flex items-center justify-center font-bold text-lg shrink-0">
              {initials}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-serif">
                  {user?.profile?.name || user?.name || "Academic Profile"}
                </h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                  <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                  Verified {isStudent ? "student" : "faculty"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap font-medium">
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3 text-muted-foreground" />
                  {user?.email}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Building2 className="size-3 text-muted-foreground" />
                  {collegeLabel || "Institute not configured"}
                </span>
                {user?.profile?.enrollmentNumber && (
                  <>
                    <span>•</span>
                    <span className="font-bold text-foreground font-mono">
                      {user.profile.enrollmentNumber}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Academic Stats */}
          <div className="flex items-center gap-2.5 self-stretch md:self-auto shrink-0">
            <div className="flex-1 md:flex-none p-3 rounded-md border border-border bg-muted/20 text-center min-w-[90px]">
              <div className="text-lg font-bold text-foreground tabular-nums">
                {classrooms?.length || 0}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                {classrooms?.length === 1 ? "Classroom" : "Classrooms"}
              </div>
            </div>
            {isStudent && (
              <div className="flex-1 md:flex-none p-3 rounded-md border border-border bg-muted/20 text-center min-w-[90px]">
                <div className="text-lg font-bold text-foreground">
                  {journals?.length || 0}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                  {journals?.length === 1 ? "Journal" : "Journals"}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ACTIVE PROFILE CORRECTION BANNER */}
        {activeRequest && (
          <div className="p-4 sm:p-5 rounded-lg border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                  <Clock className="size-3" />
                  <span>Profile Correction Request Pending</span>
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">
                  Submitted {formatRelativeTimeIST(activeRequest.createdAt)}
                  {activeRequest.bumpCount > 0 && ` • Reminders sent: ${activeRequest.bumpCount}`}
                </span>
              </div>

              <div className="text-xs text-foreground font-medium flex items-center gap-2 flex-wrap mt-0.5">
                <span className="text-muted-foreground">Requested Change:</span>
                <span className="font-semibold capitalize">{activeRequest.field}:</span>
                <span className="line-through text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded">
                  {activeRequest.currentValue || "(Empty)"}
                </span>
                <ArrowRight className="size-3 text-muted-foreground" />
                <span className="text-emerald-700 dark:text-emerald-400 font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                  {activeRequest.requestedValue}
                </span>
              </div>

              <p className="text-xs text-muted-foreground italic mt-0.5">
                &ldquo;{activeRequest.reason}&rdquo;
              </p>
            </div>

            {/* Actions: Send Reminder (with 24h cooldown) & Discard Request */}
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => bumpMutation.mutate(activeRequest.id)}
                disabled={bumpMutation.isPending || !canBump}
                className="rounded-md h-8 px-3 text-xs font-semibold gap-1.5 cursor-pointer active:scale-[0.98]"
                title={
                  canBump
                    ? "Bump request to administrator notifications"
                    : `Reminder cooldown active. Next reminder in ${remainingCooldownHours}h`
                }
              >
                {bumpMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Bell className="size-3.5" />
                )}
                <span>{canBump ? "Send Reminder" : `Reminder in ${remainingCooldownHours}h`}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                color="rose"
                size="sm"
                onClick={() => discardMutation.mutate(activeRequest.id)}
                disabled={discardMutation.isPending}
                className="rounded-md h-8 px-3 text-xs font-semibold gap-1.5 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-500/30 hover:bg-rose-500/10 cursor-pointer active:scale-[0.98]"
                title="Withdraw and delete this correction request"
              >
                {discardMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                <span>Discard Request</span>
              </Button>
            </div>
          </div>
        )}

        {/* Tab Switcher for Details vs Document Live Preview */}
        <div className="flex items-center border-b border-border gap-2 select-none">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
              activeTab === "general"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <IdCard className="size-3.5" />
            <span>Academic parameters</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
              activeTab === "preview"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Award className="size-3.5" />
            <span>Official report preview</span>
          </button>
        </div>

        {/* =========================================================================
            TAB 1: UNIFIED MASTER ACADEMIC PROFILE CANVAS
            ========================================================================= */}
        {activeTab === "general" && (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 pb-12">
            <div className="p-5 sm:p-6 rounded-lg border border-border bg-card shadow-xs flex flex-col gap-6">
              {/* Card Header with Inline Action Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-md bg-muted text-foreground flex items-center justify-center font-bold shrink-0 border border-border">
                    <IdCard className="size-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground tracking-tight font-serif">
                      {isStudent
                        ? "Student academic parameters"
                        : "Faculty appointment credentials"}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isStudent
                        ? "Institutional identifiers and cohort details printed across your laboratory journals and certificates."
                        : "Official appointment credentials, academic designation, and institutional affiliation."}
                    </p>
                  </div>
                </div>

                {/* Quick Save / Discard Controls in Header */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {isDirty && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => reset()}
                      disabled={updateMutation.isPending}
                      className="rounded-md h-8 px-3 text-xs font-medium cursor-pointer"
                    >
                      Discard
                    </Button>
                  )}

                  <Button
                    type="submit"
                    size="sm"
                    disabled={!isDirty || updateMutation.isPending}
                    className="gap-1.5 rounded-md h-8 px-3.5 text-xs font-semibold transition-all cursor-pointer active:scale-[0.98]"
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    <span>Save changes</span>
                  </Button>
                </div>
              </div>

              {/* SECTION 1: LEGAL IDENTITY & APPOINTMENT */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <User className="size-3.5 text-primary" />
                  <span>Personal identity & credentials</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {isStudent ? (
                    <>
                      {/* Full Legal Name (Locked for Student post-setup) */}
                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <div className="flex items-center justify-between">
                          <label className="font-medium text-foreground flex items-center gap-1.5">
                            <User className="size-3 text-muted-foreground" />
                            <span>Full legal name</span>
                            <Lock className="size-3 text-muted-foreground/70" />
                          </label>
                          <button
                            type="button"
                            onClick={() => openCorrectionModal("name")}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer active:scale-[0.98]"
                          >
                            <FileEdit className="size-3" />
                            <span>Request Correction</span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between h-9 px-3 rounded-md border border-border bg-muted/30 text-foreground text-xs font-semibold select-all">
                          <span>{user?.profile?.name || user?.name || "Student Name"}</span>
                          <span className="text-[10px] font-sans font-medium text-muted-foreground">
                            Governed credential
                          </span>
                        </div>
                      </div>

                      {/* Enrollment / Roll Number (Locked for Student) */}
                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <div className="flex items-center justify-between">
                          <label className="font-medium text-foreground flex items-center gap-1.5">
                            <Award className="size-3 text-muted-foreground" />
                            <span>Enrollment / Roll number</span>
                            <Lock className="size-3 text-muted-foreground/70" />
                          </label>
                          <button
                            type="button"
                            onClick={() => openCorrectionModal("enrollmentNumber")}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer active:scale-[0.98]"
                          >
                            <FileEdit className="size-3" />
                            <span>Request Correction</span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between h-9 px-3 rounded-md border border-border bg-muted/30 text-foreground font-mono font-bold text-xs select-all">
                          <span>{user?.profile?.enrollmentNumber || "Not Assigned"}</span>
                          <span className="text-[10px] font-sans font-medium text-muted-foreground">
                            Governed credential
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Teacher Full Legal Name (Locked) */}
                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <div className="flex items-center justify-between">
                          <label className="font-medium text-foreground flex items-center gap-1.5">
                            <User className="size-3 text-muted-foreground" />
                            <span>Full legal name</span>
                            <Lock className="size-3 text-muted-foreground/70" />
                          </label>
                          <button
                            type="button"
                            onClick={() => openCorrectionModal("name")}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer active:scale-[0.98]"
                          >
                            <FileEdit className="size-3" />
                            <span>Request Correction</span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between h-9 px-3 rounded-md border border-border bg-muted/30 text-foreground text-xs font-semibold select-all">
                          <span>{user?.profile?.name || user?.name || "Faculty Name"}</span>
                          <span className="text-[10px] font-sans font-medium text-muted-foreground">
                            Governed identity
                          </span>
                        </div>
                      </div>

                      {/* Faculty ID (Locked) */}
                      <div className="flex flex-col gap-1.5">
                        <label className="font-medium text-foreground flex items-center gap-1.5">
                          <ShieldCheck className="size-3 text-muted-foreground" />
                          <span>Faculty / Employee ID</span>
                          <Lock className="size-3 text-muted-foreground/70" />
                        </label>
                        <div className="flex items-center justify-between h-9 px-3 rounded-md border border-border bg-muted/30 text-foreground font-mono font-bold text-xs select-all">
                          <span>{user?.profile?.facultyId || "FAC-101"}</span>
                          <span className="text-[10px] font-sans font-medium text-muted-foreground">
                            Governed ID
                          </span>
                        </div>
                      </div>

                      {/* Academic Designation (Self-Editable) */}
                      <div className="flex flex-col gap-1.5">
                        <label className="font-medium text-foreground flex items-center gap-1.5">
                          <Award className="size-3 text-muted-foreground" />
                          <span>Academic designation</span>
                        </label>
                        <input
                          {...register("designation")}
                          placeholder="e.g. Assistant Professor, HoD"
                          className="w-full h-9 px-3 rounded-md border border-input bg-background hover:border-foreground/30 focus:border-ring focus:ring-1 focus:ring-ring text-foreground text-xs font-medium transition-all focus:outline-none"
                        />
                        {errors.designation && (
                          <span className="text-[11px] text-destructive font-medium">
                            {String(errors.designation.message)}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* SECTION DIVIDER */}
              <div className="h-px bg-border" />

              {/* SECTION 2: ACADEMIC DEPARTMENT & COHORT */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <GraduationCap className="size-3.5 text-primary" />
                  <span>
                    {isStudent
                      ? "Academic stream & laboratory cohort"
                      : "Academic department"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  {/* Department */}
                  <div className="flex flex-col gap-1.5 sm:col-span-3">
                    <div className="flex items-center justify-between">
                      <label className="font-medium text-foreground flex items-center gap-1.5">
                        <BookOpen className="size-3 text-muted-foreground" />
                        <span>Department / Academic program</span>
                        <Lock className="size-3 text-muted-foreground/70" />
                      </label>
                      <button
                        type="button"
                        onClick={() => openCorrectionModal("department")}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer active:scale-[0.98]"
                      >
                        <FileEdit className="size-3" />
                        <span>Request Correction</span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between h-9 px-3 rounded-md border border-border bg-muted/30 text-foreground text-xs font-medium">
                      <span>{departmentLabel || "Department not configured"}</span>
                      <span className="text-[10px] font-sans font-medium text-muted-foreground">
                        {isStudent ? "Governed discipline" : "Governed department"}
                      </span>
                    </div>
                    {errors.department && (
                      <span className="text-[11px] text-destructive font-medium">
                        {String(errors.department.message)}
                      </span>
                    )}
                  </div>

                  {isStudent && (
                    <>
                      {/* Current Semester (Self-Editable Select) */}
                      <div className="flex flex-col gap-1.5">
                        <label className="font-medium text-foreground">
                          Current semester
                        </label>
                        <CustomSelect
                          value={watchedSemester}
                          onChange={(val) =>
                            setValue("semester", val, { shouldDirty: true })
                          }
                          options={SEMESTER_OPTIONS}
                          placeholder="Select semester..."
                          className="w-full"
                        />
                        {errors.semester && (
                          <span className="text-[11px] text-destructive font-medium">
                            {String(errors.semester.message)}
                          </span>
                        )}
                      </div>

                      {/* Class Division (Self-Editable) */}
                      <div className="flex flex-col gap-1.5">
                        <label className="font-medium text-foreground">
                          Class division
                        </label>
                        <input
                          {...register("division")}
                          placeholder="e.g. 1, Div A"
                          className="w-full h-9 px-3 rounded-md border border-input bg-background hover:border-foreground/30 focus:border-ring focus:ring-1 focus:ring-ring text-foreground text-xs font-medium transition-all focus:outline-none"
                        />
                        {errors.division && (
                          <span className="text-[11px] text-destructive font-medium">
                            {String(errors.division.message)}
                          </span>
                        )}
                      </div>

                      {/* Practical Batch (Self-Editable) */}
                      <div className="flex flex-col gap-1.5">
                        <label className="font-medium text-foreground">
                          Practical batch
                        </label>
                        <input
                          {...register("batch")}
                          placeholder="e.g. Batch A1, B1"
                          className="w-full h-9 px-3 rounded-md border border-input bg-background hover:border-foreground/30 focus:border-ring focus:ring-1 focus:ring-ring text-foreground text-xs font-medium transition-all focus:outline-none"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* SECTION DIVIDER */}
              <div className="h-px bg-border" />

              {/* SECTION 3: INSTITUTIONAL ACCREDITATION & UNIVERSITY */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Building2 className="size-3.5 text-primary" />
                  <span>Institutional accreditation & university affiliation</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* College / Institute */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-medium text-foreground flex items-center gap-1.5">
                        <Building2 className="size-3 text-muted-foreground" />
                        <span>College / Institute name</span>
                        <Lock className="size-3 text-muted-foreground/70" />
                      </label>
                      <button
                        type="button"
                        onClick={() => openCorrectionModal("college")}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer active:scale-[0.98]"
                      >
                        <FileEdit className="size-3" />
                        <span>Request Correction</span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between h-9 px-3 rounded-md border border-border bg-muted/30 text-foreground text-xs font-medium">
                      <span>{collegeLabel || "Institute not configured"}</span>
                      <span className="text-[10px] font-sans font-medium text-muted-foreground">
                        {isStudent ? "Governed institute" : "Governed appointment"}
                      </span>
                    </div>
                    {errors.college && (
                      <span className="text-[11px] text-destructive font-medium">
                        {String(errors.college.message)}
                      </span>
                    )}
                  </div>

                  {/* University (Permanently Locked for All) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-foreground flex items-center gap-1.5">
                      <Building2 className="size-3 text-muted-foreground" />
                      <span>Affiliated university</span>
                      <Lock className="size-3 text-muted-foreground/70" />
                    </label>
                    <div className="flex items-center justify-between h-9 px-3 rounded-md border border-border bg-muted/30 text-foreground text-xs font-medium select-all">
                      <span>{CHARUSAT_UNIVERSITY_NAME}</span>
                      <span className="text-[10px] font-sans font-medium text-muted-foreground">
                        Permanent charter
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD FOOTER WITH IN-FLOW SAVE DOCK */}
              <div className="pt-4 border-t border-border flex items-center justify-between gap-4 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground">
                  {isDirty ? (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                      Unsaved modifications ready to save
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      All profile parameters synchronized with your institutional records
                    </span>
                  )}
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => reset()}
                    disabled={!isDirty || updateMutation.isPending}
                    className="rounded-md h-8 px-3 text-xs font-medium cursor-pointer"
                  >
                    Discard changes
                  </Button>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={!isDirty || updateMutation.isPending}
                    className="gap-1.5 rounded-md h-8 px-4 text-xs font-semibold transition-all cursor-pointer active:scale-[0.98]"
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    <span>Save profile changes</span>
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
          <div className="p-5 sm:p-6 rounded-lg border border-border bg-card shadow-xs flex flex-col gap-6">
            <div className="border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2 font-serif">
                <Award className="size-4 text-primary" />
                <span>Live document credential preview</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                This shows exactly how your academic identity is formatted on printed Cover Pages, Certificates, and Lab Journals.
              </p>
            </div>

            {/* Candidate Information Box Representation */}
            <div className="w-full max-w-lg mx-auto border border-border p-6 rounded-md text-left bg-card text-foreground select-none shadow-xs font-serif">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2 mb-4">
                {isStudent
                  ? "Candidate information (Official record)"
                  : "Faculty in-charge evaluation record"}
              </div>

              <div className="grid grid-cols-2 gap-y-2.5 text-xs font-sans">
                <span className="text-muted-foreground font-medium">
                  {isStudent ? "Student name:" : "Faculty in-charge:"}
                </span>
                <strong className="text-foreground font-semibold">
                  {user?.profile?.name || user?.name || watchedValues.name || "Full Name"}
                </strong>

                <span className="text-muted-foreground font-medium">
                  {isStudent ? "Roll / Enrollment no:" : "Faculty ID:"}
                </span>
                <strong className="text-foreground font-mono font-bold">
                  {isStudent
                    ? user?.profile?.enrollmentNumber || watchedValues.enrollmentNumber || "24CS065"
                    : user?.profile?.facultyId || watchedValues.facultyId || "FAC-101"}
                </strong>

                <span className="text-muted-foreground font-medium">Department:</span>
                <span className="text-foreground font-medium">
                  {departmentLabel || "Computer Science"}
                </span>

                {isStudent ? (
                  <>
                    <span className="text-muted-foreground font-medium">Semester & Div:</span>
                    <strong className="text-foreground font-semibold">
                      Sem {watchedValues.semester || "1"} • {watchedValues.division || "Div 1"}
                    </strong>

                    <span className="text-muted-foreground font-medium">Practical batch:</span>
                    <strong className="text-foreground font-semibold">
                      {watchedValues.batch || "Batch A"}
                    </strong>
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground font-medium">Designation:</span>
                    <strong className="text-foreground font-medium">
                      {watchedValues.designation || "Assistant Professor"}
                    </strong>
                  </>
                )}

                <span className="text-muted-foreground font-medium">Institute / College:</span>
                <span className="text-foreground font-medium">
                  {collegeLabel || "Institute of Technology"}
                </span>

                <span className="text-muted-foreground font-medium">Affiliated university:</span>
                <span className="text-foreground font-medium">{CHARUSAT_UNIVERSITY_NAME}</span>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                <span>Verified status: ACTIVE</span>
                <span>ISO A4 Verified</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =========================================================================
          STUDENT CORRECTION REQUEST MODAL
          ========================================================================= */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <FileEdit className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground font-serif">
                    Request Record Correction
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Official institutional credentials require administrative verification.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCorrectionModal(false)}
                className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                aria-label="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs">
              {activeRequest ? (
                <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 space-y-1">
                  <span className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="size-3.5" />
                    Active Correction Request Already Under Review
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    To prevent duplicate requests, users may only have one active request at a time. Please wait for administration to review your pending request, or discard it before submitting a new one.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-foreground">Select Field to Correct</label>
                    <CustomSelect
                      value={selectedCorrectionField}
                      onChange={(val: any) => {
                        setSelectedCorrectionField(val);
                        setCorrectionRequestedValue("");
                      }}
                      options={
                        isStudent
                          ? [
                              { value: "enrollmentNumber", label: "Enrollment / Roll Number" },
                              { value: "name", label: "Full Legal Name" },
                              { value: "department", label: "Academic Department" },
                              { value: "college", label: "Constituent College / Institute" },
                            ]
                          : [
                              { value: "name", label: "Full Legal Name" },
                              { value: "department", label: "Academic Department" },
                              { value: "college", label: "Constituent College / Institute" },
                            ]
                      }
                      className="w-full"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-muted-foreground">Current Recorded Value</label>
                    <div className="h-9 px-3 rounded-md border border-border bg-muted/40 text-muted-foreground text-xs font-mono font-medium flex items-center">
                      {currentFieldValueDisplay || "(None)"}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-foreground">Desired Corrected Value</label>
                    {selectedCorrectionField === "college" ? (
                      <CustomSelect
                        value={correctionRequestedValue}
                        onChange={setCorrectionRequestedValue}
                        options={CHARUSAT_COLLEGES}
                        placeholder="Select constituent college..."
                        className="w-full"
                      />
                    ) : selectedCorrectionField === "department" ? (
                      <CustomSelect
                        value={correctionRequestedValue}
                        onChange={setCorrectionRequestedValue}
                        options={CHARUSAT_DEPARTMENTS}
                        placeholder="Select academic department..."
                        className="w-full"
                      />
                    ) : (
                      <input
                        type="text"
                        value={correctionRequestedValue}
                        onChange={(e) =>
                          setCorrectionRequestedValue(
                            selectedCorrectionField === "enrollmentNumber"
                              ? e.target.value.toUpperCase()
                              : e.target.value
                          )
                        }
                        placeholder={
                          selectedCorrectionField === "enrollmentNumber"
                            ? "e.g. 24CS065"
                            : "e.g. Harshal Patel"
                        }
                        className="w-full h-9 px-3 rounded-md border border-input bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-foreground">
                      Institutional Justification / Reason (Required)
                    </label>
                    <textarea
                      value={correctionReason}
                      onChange={(e) => setCorrectionReason(e.target.value)}
                      placeholder="Explain the reason for this correction (e.g. Typographical error during registration, verified against student ID card)..."
                      rows={3}
                      className="w-full p-2.5 rounded-md border border-input bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Minimum 10 characters required. Reviewed by university administrators.
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-border bg-muted/20 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCorrectionModal(false)}
                disabled={submitCorrectionMutation.isPending}
                className="rounded-md text-xs font-medium cursor-pointer"
              >
                Cancel
              </Button>

              {!activeRequest && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSubmitCorrection}
                  disabled={
                    submitCorrectionMutation.isPending ||
                    !correctionRequestedValue.trim() ||
                    correctionReason.trim().length < 10
                  }
                  className="rounded-md text-xs font-semibold gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  {submitCorrectionMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  <span>Submit Correction Request</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
