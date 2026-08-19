/**
 * Teacher Classroom Submissions & 2D Gradebook Matrix Page.
 *
 * Streamlined Apple HIG & Impeccable Design:
 * - Unified single-line filter toolbar (Search, Status, Practical, Batch, Sort, Density)
 * - Compact horizontal performance ribbon (replaces visual clutter of 5 stacked cards)
 * - True compact/comfortable matrix density with sticky frozen columns
 * - Restored draft & active submission queues with zero regressions
 */

"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  GraduationCap,
  Sparkles,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileEdit,
  Download,
  Table,
  ListFilter,
  Check,
  Clock,
  Search,
  X,
  Award,
  BookOpen,
  ChevronRight,
  Maximize2,
  Minimize2,
} from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { GlassDropdown, DropdownOption } from "@/components/ui/glass-dropdown";

interface PageProps {
  params: Promise<{ id: string }>;
}

type StatusFilterType = "ALL" | "approved" | "submitted" | "changes_requested" | "draft";
type SortOptionType = "enrollment_asc" | "name_asc" | "percentage_desc" | "percentage_asc";

export default function ClassroomGradesPage({ params }: PageProps) {
  const { id: classroomId } = use(params);
  const searchParams = useSearchParams();
  const urlAssignment = searchParams.get("assignment");

  const [activeTab, setActiveTab] = useState<"matrix" | "submissions">("matrix");
  const [selectedBatch, setSelectedBatch] = useState<string>("ALL");
  const [selectedAssignment, setSelectedAssignment] = useState<string>(urlAssignment || "ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("ALL");
  const [sortOption, setSortOption] = useState<SortOptionType>("enrollment_asc");
  const [isCompactDensity, setIsCompactDensity] = useState<boolean>(false);
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);

  useEffect(() => {
    if (urlAssignment) {
      setSelectedAssignment(urlAssignment);
      setActiveTab("submissions");
    }
  }, [urlAssignment]);

  // 1. Fetch classroom details
  const { data: classroom } = useQuery<any>({
    queryKey: ["classroom", classroomId],
    queryFn: () => api.get(`/classrooms/${classroomId}`),
  });

  // 2. Fetch classroom assignments
  const { data: assignments } = useQuery<any[]>({
    queryKey: ["assignments", classroomId],
    queryFn: () => api.get(`/classrooms/${classroomId}/assignments`),
  });

  // 3. Fetch 2D Gradebook Matrix
  const { data: gradebookData, isLoading: gradebookLoading } = useQuery<any>({
    queryKey: ["gradebook", classroomId, selectedBatch],
    queryFn: () =>
      api.get(`/classrooms/${classroomId}/gradebook${selectedBatch !== "ALL" ? `?batch=${selectedBatch}` : ""}`),
  });

  // 4. Fetch classroom submissions for teacher (including drafts)
  const { data: submissions, isLoading: submissionsLoading } = useQuery<any[]>({
    queryKey: ["submissions", classroomId],
    queryFn: () => api.get(`/journals/classroom/${classroomId}/submissions`),
  });

  // Class Performance Distribution Statistics
  const performanceStats = useMemo(() => {
    const students = gradebookData?.students || [];
    let distinction = 0;
    let firstClass = 0;
    let passClass = 0;
    let needsImprovement = 0;
    let pending = 0;

    for (const s of students) {
      if (s.completedCount === 0) {
        pending += 1;
      } else if (s.percentage >= 75) {
        distinction += 1;
      } else if (s.percentage >= 60) {
        firstClass += 1;
      } else if (s.percentage >= 40) {
        passClass += 1;
      } else {
        needsImprovement += 1;
      }
    }

    return {
      total: students.length,
      distinction,
      firstClass,
      passClass,
      needsImprovement,
      pending,
    };
  }, [gradebookData]);

  // Filtered & Sorted Gradebook Matrix Students
  const filteredMatrixStudents = useMemo(() => {
    if (!gradebookData?.students) return [];

    let list = [...gradebookData.students];

    // Search query filter (Name, Enrollment, Email)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const nameMatch = (s.name || "").toLowerCase().includes(q);
        const enrollMatch = (s.enrollmentNumber || "").toLowerCase().includes(q);
        const emailMatch = (s.email || "").toLowerCase().includes(q);
        return nameMatch || enrollMatch || emailMatch;
      });
    }

    // Status filter
    if (statusFilter !== "ALL") {
      list = list.filter((s) => {
        const grades = Object.values(s.grades || {}) as any[];
        if (statusFilter === "approved") {
          return grades.some((g) => g.status === "approved");
        }
        if (statusFilter === "submitted") {
          return grades.some((g) => g.status === "submitted" || g.status === "late_submitted");
        }
        if (statusFilter === "changes_requested") {
          return grades.some((g) => g.status === "changes_requested");
        }
        if (statusFilter === "draft") {
          return grades.some((g) => g.status === "draft");
        }
        return true;
      });
    }

    // Sorting
    list.sort((a, b) => {
      if (sortOption === "enrollment_asc") {
        return (a.enrollmentNumber || "").localeCompare(b.enrollmentNumber || "");
      }
      if (sortOption === "name_asc") {
        return (a.name || "").localeCompare(b.name || "");
      }
      if (sortOption === "percentage_desc") {
        return (b.percentage || 0) - (a.percentage || 0);
      }
      if (sortOption === "percentage_asc") {
        return (a.percentage || 0) - (b.percentage || 0);
      }
      return 0;
    });

    return list;
  }, [gradebookData, searchQuery, statusFilter, sortOption]);

  // Filtered Submissions List
  const filteredSubmissions = useMemo(() => {
    if (!submissions) return [];

    let list = [...submissions];

    // Batch filter
    if (selectedBatch !== "ALL") {
      list = list.filter((sub) => sub.studentBatch === selectedBatch);
    }

    // Assignment filter
    if (selectedAssignment !== "ALL") {
      list = list.filter((sub) => sub.assignmentId === selectedAssignment);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((sub) => {
        const nameMatch = (sub.studentName || "").toLowerCase().includes(q);
        const enrollMatch = (sub.enrollmentNumber || sub.studentEnrollment || "").toLowerCase().includes(q);
        const emailMatch = (sub.studentEmail || "").toLowerCase().includes(q);
        const titleMatch = (sub.assignmentTitle || sub.experimentTitle || "").toLowerCase().includes(q);
        return nameMatch || enrollMatch || emailMatch || titleMatch;
      });
    }

    // Status filter
    if (statusFilter !== "ALL") {
      list = list.filter((sub) => {
        if (statusFilter === "submitted") {
          return sub.status === "submitted" || sub.status === "late_submitted";
        }
        return sub.status === statusFilter;
      });
    }

    return list;
  }, [submissions, selectedBatch, selectedAssignment, searchQuery, statusFilter]);

  const activeAssignmentObj = assignments?.find((a: any) => a.id === selectedAssignment);
  const isFiltersActive = searchQuery.trim() !== "" || statusFilter !== "ALL" || selectedBatch !== "ALL" || selectedAssignment !== "ALL";

  // Dropdown Options
  const practicalOptions: DropdownOption[] = useMemo(() => {
    if (!assignments) return [];
    return [
      {
        value: "ALL",
        label: "All Practicals",
        count: submissions?.length || 0,
        icon: <BookOpen className="size-3.5 text-indigo-500 shrink-0" />,
      },
      ...assignments.map((asg: any) => ({
        value: asg.id,
        label: asg.title || `Practical ${asg.experimentNumber}`,
        badge: `Exp ${String(asg.experimentNumber).padStart(2, "0")}`,
        count: (submissions || []).filter((s: any) => s.assignmentId === asg.id).length,
      })),
    ];
  }, [assignments, submissions]);

  const batchOptions: DropdownOption[] = useMemo(() => {
    const batches = gradebookData?.summary?.availableBatches || classroom?.batches || [];
    return [
      { value: "ALL", label: "All Batches" },
      ...batches.map((b: string) => ({
        value: b,
        label: `Batch ${b}`,
        badge: b,
      })),
    ];
  }, [gradebookData, classroom]);

  const sortOptions: DropdownOption[] = [
    { value: "enrollment_asc", label: "Enrollment (Asc)" },
    { value: "name_asc", label: "Student Name (A-Z)" },
    { value: "percentage_desc", label: "Highest Score %" },
    { value: "percentage_asc", label: "Lowest Score %" },
  ];

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setSelectedBatch("ALL");
    setSelectedAssignment("ALL");
  };

  // Handle CSV Export
  const handleExportCsv = async () => {
    try {
      setIsExportingCsv(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const batchParam = selectedBatch !== "ALL" ? `?batch=${selectedBatch}` : "";
      const res = await fetch(`${apiUrl}/classrooms/${classroomId}/gradebook/export/csv${batchParam}`, {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to export gradebook CSV");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (classroom?.name || "Classroom").replace(/[^a-zA-Z0-9_-]/g, "_");
      a.download = `Gradebook_${safeName}${selectedBatch !== "ALL" ? `_${selectedBatch}` : ""}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export CSV Error:", err);
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background relative overflow-x-hidden">
      {/* Top Bar Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 sm:px-8 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="rounded-xl gap-1 hover:bg-muted/80">
              <Link href={`/classrooms/${classroomId}`}>
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Back to Classroom</span>
              </Link>
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <GraduationCap className="size-5 text-indigo-500" />
              <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <span>{classroom?.name || "Classroom"}</span>
                <ChevronRight className="size-3.5 text-muted-foreground/60" />
                <span className="text-muted-foreground font-semibold">Gradebook</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              onClick={handleExportCsv}
              disabled={isExportingCsv}
              size="sm"
              className="rounded-xl gap-2 font-bold shadow-xs cursor-pointer"
            >
              <Download className={`size-3.5 ${isExportingCsv ? "animate-bounce" : ""}`} />
              <span>{isExportingCsv ? "Exporting..." : "Export CSV"}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Workspace Content */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-4">
        {/* Streamlined Header & Tab Switcher Bar */}
        <div className="p-4 sm:p-5 rounded-3xl glass-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-border/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                  {classroom?.name || "Classroom"}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-500/20">
                  {classroom?.subject}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold border border-border hidden md:inline">
                  Sem {classroom?.semester} • Div {classroom?.division}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Continuous assessment matrix & student submission evaluation
              </span>
            </div>
          </div>

          {/* View Mode Switcher Pills */}
          <div className="flex items-center p-1 bg-muted/60 rounded-2xl border border-border/60 shrink-0 self-stretch sm:self-auto justify-center">
            <button
              onClick={() => setActiveTab("matrix")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "matrix"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Table className="size-3.5 text-indigo-500" />
              <span>2D Matrix</span>
            </button>
            <button
              onClick={() => setActiveTab("submissions")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "submissions"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ListFilter className="size-3.5 text-emerald-500" />
              <span>Submissions Queue</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 font-mono font-bold">
                {submissions?.length || 0}
              </span>
            </button>
          </div>
        </div>

        {/* Compact Integrated Performance Strip (Saves 300px of vertical clutter) */}
        {performanceStats.total > 0 && (
          <div className="px-5 py-3.5 rounded-2xl glass-card border border-border/70 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Quick Metrics */}
            <div className="flex items-center gap-6 shrink-0 text-xs">
              <div>
                <span className="text-muted-foreground font-semibold">Enrolled: </span>
                <span className="font-extrabold text-foreground">{performanceStats.total} Students</span>
              </div>
              <div className="h-3 w-px bg-border hidden sm:block" />
              <div>
                <span className="text-muted-foreground font-semibold">Practicals: </span>
                <span className="font-extrabold text-indigo-500">{gradebookData?.summary?.totalAssignments || 0} Exps</span>
              </div>
              <div className="h-3 w-px bg-border hidden sm:block" />
              <div>
                <span className="text-muted-foreground font-semibold">Class Continuous Avg: </span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                  {gradebookData?.summary?.classAveragePercentage || 0}%
                </span>
              </div>
            </div>

            {/* Micro Segmented Progress & Legend */}
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="flex-1 bg-muted/60 h-2 rounded-full overflow-hidden flex border border-border/40">
                {performanceStats.distinction > 0 && (
                  <div
                    style={{ width: `${(performanceStats.distinction / performanceStats.total) * 100}%` }}
                    className="bg-emerald-500 h-full transition-all duration-500"
                    title={`Distinction: ${performanceStats.distinction}`}
                  />
                )}
                {performanceStats.firstClass > 0 && (
                  <div
                    style={{ width: `${(performanceStats.firstClass / performanceStats.total) * 100}%` }}
                    className="bg-indigo-500 h-full transition-all duration-500"
                    title={`First Class: ${performanceStats.firstClass}`}
                  />
                )}
                {performanceStats.passClass > 0 && (
                  <div
                    style={{ width: `${(performanceStats.passClass / performanceStats.total) * 100}%` }}
                    className="bg-amber-500 h-full transition-all duration-500"
                    title={`Pass: ${performanceStats.passClass}`}
                  />
                )}
                {performanceStats.needsImprovement > 0 && (
                  <div
                    style={{ width: `${(performanceStats.needsImprovement / performanceStats.total) * 100}%` }}
                    className="bg-rose-500 h-full transition-all duration-500"
                    title={`Needs Imp: ${performanceStats.needsImprovement}`}
                  />
                )}
              </div>

              {/* Compact Legend Pills */}
              <div className="flex items-center gap-2 text-[11px] font-bold shrink-0 text-muted-foreground">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <span className="size-2 rounded-full bg-emerald-500" /> {performanceStats.distinction} Dist.
                </span>
                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                  <span className="size-2 rounded-full bg-indigo-500" /> {performanceStats.firstClass} First
                </span>
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <span className="size-2 rounded-full bg-amber-500" /> {performanceStats.passClass} Pass
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Single Unified Toolbar (Clean, minimal, 1-container) */}
        <div className="p-3 rounded-2xl glass-card flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 border border-border/70 shadow-2xs">
          {/* Left: Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student, enrollment, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8.5 pl-8.5 pr-7 rounded-xl bg-muted/40 border border-border/70 text-xs font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Right: Controls Strip */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Segmented Control */}
            <div className="flex items-center p-0.5 bg-muted/50 rounded-xl border border-border/50 text-xs font-bold shrink-0">
              <button
                onClick={() => setStatusFilter("ALL")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter("approved")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === "approved"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-muted-foreground hover:text-emerald-600"
                }`}
              >
                Approved
              </button>
              <button
                onClick={() => setStatusFilter("submitted")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === "submitted"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "text-muted-foreground hover:text-indigo-600"
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setStatusFilter("changes_requested")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === "changes_requested"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "text-muted-foreground hover:text-amber-600"
                }`}
              >
                Revision
              </button>
              <button
                onClick={() => setStatusFilter("draft")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === "draft"
                    ? "bg-slate-700 text-white shadow-2xs"
                    : "text-muted-foreground hover:text-slate-700"
                }`}
              >
                Draft
              </button>
            </div>

            {/* Practical Selector (In Submissions Mode) */}
            {activeTab === "submissions" && assignments && assignments.length > 0 && (
              <GlassDropdown
                value={selectedAssignment}
                options={practicalOptions}
                onChange={(val) => setSelectedAssignment(val)}
                placeholder="Select Practical"
              />
            )}

            {/* Batch Selector */}
            {((classroom?.batches && classroom.batches.length > 0) || (gradebookData?.summary?.availableBatches?.length > 0)) && (
              <GlassDropdown
                value={selectedBatch}
                options={batchOptions}
                onChange={(val) => setSelectedBatch(val)}
                placeholder="Select Batch"
              />
            )}

            {/* Sorting Dropdown */}
            <GlassDropdown
              value={sortOption}
              options={sortOptions}
              onChange={(val) => setSortOption(val as SortOptionType)}
              placeholder="Sort By"
            />

            {/* Density Switcher (Matrix Mode) */}
            {activeTab === "matrix" && (
              <Button
                onClick={() => setIsCompactDensity(!isCompactDensity)}
                variant="ghost"
                size="sm"
                className="h-8.5 px-2 rounded-xl text-xs font-bold text-muted-foreground border border-border/60 hover:text-foreground"
                title={isCompactDensity ? "Switch to Comfortable spacing" : "Switch to Compact density"}
              >
                {isCompactDensity ? <Maximize2 className="size-3.5" /> : <Minimize2 className="size-3.5" />}
                <span className="ml-1 text-[11px] hidden sm:inline">{isCompactDensity ? "Spacious" : "Compact"}</span>
              </Button>
            )}

            {/* Reset Filters */}
            {isFiltersActive && (
              <button
                onClick={handleResetFilters}
                className="text-xs font-bold text-primary hover:underline px-2 cursor-pointer shrink-0"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: 2D GRADEBOOK MATRIX SPREADSHEET */}
        {/* ========================================================================= */}
        {activeTab === "matrix" && (
          <div className="rounded-3xl glass-card border border-border/80 overflow-hidden shadow-sm flex flex-col">
            {gradebookLoading ? (
              <div className="flex items-center justify-center p-16">
                <p className="text-xs text-muted-foreground animate-pulse">Calculating gradebook matrix...</p>
              </div>
            ) : filteredMatrixStudents.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center gap-2">
                <GraduationCap className="size-8 text-muted-foreground/40" />
                <h4 className="font-bold text-sm">No Matching Students Found</h4>
                <p className="text-xs text-muted-foreground">
                  {isFiltersActive ? "Try clearing or adjusting your active filters." : "Students enrolled in this classroom will appear here."}
                </p>
                {isFiltersActive && (
                  <Button onClick={handleResetFilters} variant="outline" size="sm" className="rounded-xl text-xs font-semibold mt-2">
                    Reset All Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto relative">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/50 text-muted-foreground font-bold">
                      {/* Pinned Left Columns */}
                      <th className={`pl-4 w-10 shrink-0 ${isCompactDensity ? "py-1.5" : "py-3"} sticky left-0 bg-muted/95 backdrop-blur z-20 border-r border-border/40`}>
                        #
                      </th>
                      <th className={`min-w-[110px] ${isCompactDensity ? "py-1.5 px-2.5" : "py-3 px-3.5"} sticky left-10 bg-muted/95 backdrop-blur z-20 border-r border-border/40`}>
                        Enrollment
                      </th>
                      <th className={`min-w-[170px] ${isCompactDensity ? "py-1.5 px-2.5" : "py-3 px-3.5"} sticky left-[150px] bg-muted/95 backdrop-blur z-20 border-r border-border/60 shadow-xs`}>
                        Student Name
                      </th>

                      <th className={`w-16 ${isCompactDensity ? "py-1.5 px-2" : "py-3 px-3"}`}>Batch</th>

                      {/* Practical Columns */}
                      {gradebookData.assignments.map((asg: any) => (
                        <th key={asg.id} className={`min-w-[130px] text-center border-l border-border/40 ${isCompactDensity ? "py-1.5 px-2" : "py-3 px-3"}`}>
                          <div className="flex flex-col items-center">
                            <span className="text-foreground font-extrabold">Exp #{asg.experimentNumber}</span>
                            <span className="text-[10px] text-muted-foreground/70 font-semibold truncate max-w-[110px]" title={asg.title}>
                              {asg.title || `Max: ${asg.maxMarks}`}
                            </span>
                          </div>
                        </th>
                      ))}

                      {/* Total Score & Standing Columns */}
                      <th className={`min-w-[120px] text-center border-l border-border/40 bg-muted/60 ${isCompactDensity ? "py-1.5" : "py-3"}`}>
                        Total Graded
                      </th>
                      <th className={`min-w-[90px] text-center bg-muted/60 ${isCompactDensity ? "py-1.5" : "py-3"}`}>
                        Continuous %
                      </th>
                      <th className={`min-w-[110px] text-center pr-4 bg-muted/60 ${isCompactDensity ? "py-1.5" : "py-3"}`}>
                        Standing
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredMatrixStudents.map((student: any, idx: number) => {
                      return (
                        <tr key={student.studentId} className="hover:bg-muted/30 transition-colors group">
                          {/* Pinned Left Columns */}
                          <td className={`pl-4 font-semibold text-muted-foreground ${isCompactDensity ? "py-1.5" : "py-3"} sticky left-0 bg-background/95 backdrop-blur group-hover:bg-muted/40 z-10 border-r border-border/40`}>
                            {idx + 1}
                          </td>
                          <td className={`font-bold text-foreground font-mono ${isCompactDensity ? "py-1.5 px-2.5" : "py-3 px-3.5"} sticky left-10 bg-background/95 backdrop-blur group-hover:bg-muted/40 z-10 border-r border-border/40`}>
                            {student.enrollmentNumber}
                          </td>
                          <td className={`${isCompactDensity ? "py-1.5 px-2.5" : "py-3 px-3.5"} sticky left-[150px] bg-background/95 backdrop-blur group-hover:bg-muted/40 z-10 border-r border-border/60 shadow-xs`} title={student.email || ""}>
                            <div className="flex flex-col">
                              <span className="font-bold text-foreground">{student.name}</span>
                              {!isCompactDensity && student.email && (
                                <span className="text-[10px] text-muted-foreground/70 font-mono">{student.email}</span>
                              )}
                            </div>
                          </td>

                          <td className={`${isCompactDensity ? "py-1.5 px-2" : "py-3 px-3"}`}>
                            {student.batch && student.batch !== "N/A" ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                                {student.batch}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50 text-[11px]">—</span>
                            )}
                          </td>

                          {/* Practical Evaluation Cells */}
                          {gradebookData.assignments.map((asg: any) => {
                            const g = student.grades[asg.id] || {};
                            const statusStr = g.status || "not_started";
                            const marks = g.marks;

                            return (
                              <td key={asg.id} className={`text-center border-l border-border/40 ${isCompactDensity ? "py-1 px-1.5" : "py-2 px-2.5"}`}>
                                {statusStr === "approved" && marks !== null ? (
                                  <Link
                                    href={`/editor/${g.journalId}`}
                                    className={`inline-flex items-center gap-1 rounded-full font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:scale-105 transition-transform cursor-pointer ${
                                      isCompactDensity ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
                                    }`}
                                    title={`Approved: ${marks}/${asg.maxMarks}${g.approvedAt ? ` on ${new Date(g.approvedAt).toLocaleDateString()}` : ""}`}
                                  >
                                    <Check className="size-3" />
                                    <span>{marks}/{asg.maxMarks}</span>
                                  </Link>
                                ) : statusStr === "submitted" || statusStr === "late_submitted" ? (
                                  <Link
                                    href={`/editor/${g.journalId}`}
                                    className={`inline-flex items-center gap-1 rounded-full font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 hover:scale-105 transition-transform cursor-pointer ${
                                      isCompactDensity ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"
                                    }`}
                                    title="Submitted: Ready for evaluation"
                                  >
                                    <Clock className="size-3" />
                                    <span>Grade</span>
                                  </Link>
                                ) : statusStr === "changes_requested" ? (
                                  <Link
                                    href={`/editor/${g.journalId}`}
                                    className={`inline-flex items-center gap-1 rounded-full font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:scale-105 transition-transform cursor-pointer ${
                                      isCompactDensity ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"
                                    }`}
                                    title="Revision requested"
                                  >
                                    <FileEdit className="size-3" />
                                    <span>Revision</span>
                                  </Link>
                                ) : statusStr === "draft" ? (
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 ${
                                      isCompactDensity ? "px-1.5 py-0.2 text-[9px]" : "px-2 py-0.5 text-[10px]"
                                    }`}
                                    title="Student draft in progress"
                                  >
                                    In Progress
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground/40 font-medium" title="Not started">—</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Totals & Standing */}
                          <td className={`text-center border-l border-border/40 bg-muted/20 ${isCompactDensity ? "py-1.5" : "py-3"}`}>
                            <div className="flex flex-col items-center justify-center">
                              <span className="font-extrabold text-foreground">
                                {student.totalMarksObtained} / {student.completedCount > 0 ? student.evaluatedMaxMarks : student.totalMaxMarks}
                              </span>
                              {!isCompactDensity && (
                                <span className="text-[9px] text-muted-foreground/70 font-semibold">
                                  {student.completedCount} of {student.totalAssignmentsCount} graded
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={`text-center font-extrabold text-foreground bg-muted/20 ${isCompactDensity ? "py-1.5" : "py-3"}`}>
                            {student.completedCount > 0 ? (
                              <span className={student.percentage >= 75 ? "text-emerald-600 dark:text-emerald-400" : student.percentage >= 60 ? "text-indigo-600 dark:text-indigo-400" : "text-amber-600 dark:text-amber-400"}>
                                {student.percentage}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40 font-medium">—</span>
                            )}
                          </td>
                          <td className={`text-center pr-4 bg-muted/20 ${isCompactDensity ? "py-1.5" : "py-3"}`}>
                            {student.completedCount > 0 ? (
                              <span className={`px-2.5 py-0.5 rounded-full font-bold ${
                                isCompactDensity ? "text-[9px]" : "text-[10px]"
                              } ${
                                student.percentage >= 75
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                  : student.percentage >= 60
                                  ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30"
                                  : student.percentage >= 40
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                              }`}>
                                {student.standing || (student.percentage >= 75 ? "Distinction" : student.percentage >= 60 ? "First Class" : student.percentage >= 40 ? "Pass" : "Needs Imp.")}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground/70 border border-border">
                                Pending
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SUBMISSIONS QUEUE VIEW */}
        {/* ========================================================================= */}
        {activeTab === "submissions" && (
          <div className="flex flex-col gap-4 animate-in fade-in-50 duration-200">
            {submissionsLoading ? (
              <div className="flex items-center justify-center p-12 glass-card rounded-3xl">
                <p className="text-sm text-muted-foreground animate-pulse">Loading submissions queue...</p>
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-3xl glass-card text-center p-6 gap-3">
                <GraduationCap className="size-10 text-muted-foreground/50 mb-1" />
                <h4 className="font-bold text-lg tracking-tight">No Submissions Found</h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {isFiltersActive
                    ? "No student submissions matched your active filter settings."
                    : "When students begin or submit their practical journals, they will appear in this review queue."}
                </p>
                {isFiltersActive && (
                  <Button onClick={handleResetFilters} variant="outline" size="sm" className="rounded-xl text-xs font-semibold mt-2 cursor-pointer">
                    Clear All Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSubmissions.map((sub: any) => {
                  const isApproved = sub.status === "approved";
                  const isChangesReq = sub.status === "changes_requested";
                  const isSubmitted = sub.status === "submitted" || sub.status === "late_submitted";
                  const isDraft = sub.status === "draft";
                  const isLate = sub.isLate;

                  return (
                    <div
                      key={sub.id}
                      className="p-5 rounded-3xl glass-card flex flex-col justify-between gap-4 border border-border/80 hover:border-primary/40 transition-all shadow-sm group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">{sub.studentName}</span>
                            {sub.studentBatch && sub.studentBatch !== "N/A" && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                                {sub.studentBatch}
                              </span>
                            )}
                          </div>
                          {sub.studentEmail && (
                            <span className="text-[10px] font-mono text-muted-foreground/70">
                              {sub.studentEmail}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground font-medium">
                            Enrollment: <span className="font-semibold text-foreground font-mono">{sub.enrollmentNumber || sub.studentEnrollment || "N/A"}</span>
                          </span>
                        </div>

                        {/* Status Badges */}
                        <div className="flex flex-col items-end gap-1">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="size-3.5" />
                              <span>Approved ({sub.marks || 0}/{sub.maxMarks || 10})</span>
                            </span>
                          ) : isChangesReq ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                              <FileEdit className="size-3.5" />
                              <span>Changes Requested</span>
                            </span>
                          ) : isSubmitted ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                              <Clock className="size-3.5" />
                              <span>Submitted</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-500/10 px-2.5 py-1 rounded-full border border-slate-500/20">
                              <span>In Progress (Draft)</span>
                            </span>
                          )}
                          {isLate && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                              <AlertTriangle className="size-3" />
                              <span>Late Submission</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Assignment metadata */}
                      <div className="p-3 rounded-2xl bg-muted/40 flex flex-col gap-1 border border-border/50">
                        <span className="text-xs font-bold text-foreground">
                          Exp #{sub.experimentNumber}: {sub.assignmentTitle || sub.experimentTitle || "Practical"}
                        </span>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>
                            {sub.submittedAt ? `Submitted: ${new Date(sub.submittedAt).toLocaleDateString()}` : "Status: Draft in progress"}
                          </span>
                          <span>Max Marks: {sub.maxMarks || 10}</span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                        <Button asChild size="sm" className="rounded-xl font-bold cursor-pointer">
                          <Link href={`/editor/${sub.id}`}>
                            {isApproved ? "View Evaluation" : isSubmitted ? "Grade Submission" : "View Journal"}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
