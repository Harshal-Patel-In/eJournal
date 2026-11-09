"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Download,
  Filter,
  GraduationCap,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Sliders,
  Users,
  Building,
  CheckCircle2,
  BookOpen,
} from "lucide-react";

import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { formatDateIST } from "@/lib/date";

export default function DefaultersRadarPage() {
  const [threshold, setThreshold] = useState<number>(75);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [batchFilter, setBatchFilter] = useState<string>("all");

  // 1. Fetch Classrooms for Filter Dropdown
  const { data: classroomsData } = useQuery<any>({
    queryKey: ["admin-classroom-options"],
    queryFn: () => api.get("/admin/classrooms?limit=100"),
  });

  // 2. Fetch Defaulters Data
  const { data, isLoading, refetch, isRefetching } = useQuery<any>({
    queryKey: ["admin-defaulters-radar", threshold, selectedClassroomId],
    queryFn: () => {
      const params = new URLSearchParams({
        threshold: threshold.toString(),
      });
      if (selectedClassroomId) params.set("classroomId", selectedClassroomId);
      return api.get(`/admin/analytics/defaulters?${params.toString()}`);
    },
  });

  const defaulters: any[] = data?.defaulters || [];
  const totalEvaluated = data?.totalStudents ?? data?.totalEvaluatedStudents ?? 0;

  // Deduplicate defaulters by studentId (defense-in-depth against duplicate keys)
  const uniqueDefaulters = useMemo(() => {
    const seen = new Set<string>();
    return defaulters.filter((d: any) => {
      const id = String(d.studentId || d.id || "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [defaulters]);

  const defaultersCount = data?.defaultersCount ?? uniqueDefaulters.length;
  const defaulterRate = totalEvaluated > 0 ? ((defaultersCount / totalEvaluated) * 100).toFixed(1) : "0.0";

  // Filter list by search query (name or enrollment) and batch
  const filteredDefaulters = uniqueDefaulters.filter((d: any) => {
    const query = search.toLowerCase().trim();
    const matchesSearch =
      !query ||
      d.name?.toLowerCase().includes(query) ||
      d.enrollmentNumber?.toLowerCase().includes(query) ||
      d.email?.toLowerCase().includes(query);

    const matchesBatch =
      batchFilter === "all" ||
      d.batch === batchFilter;

    return matchesSearch && matchesBatch;
  });

  // Extract unique batches for secondary filter
  const availableBatches = Array.from(
    new Set(uniqueDefaulters.map((d: any) => d.batch).filter(Boolean))
  ).sort();

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!filteredDefaulters || filteredDefaulters.length === 0) {
      toast.error("No defaulter records available to export.");
      return;
    }

    const headers = [
      "Enrollment Number",
      "Full Name",
      "Email",
      "Department",
      "Semester",
      "Division",
      "Batch",
      "Overall Completion %",
      "Eligibility Status",
    ];

    const rows = filteredDefaulters.map((d: any) => {
      const pct = d.completionRate ?? d.overallCompletionPercentage ?? 0;
      return [
        `"${d.enrollmentNumber || ""}"`,
        `"${d.name || ""}"`,
        `"${d.email || ""}"`,
        `"${d.department || ""}"`,
        `"${d.semester || ""}"`,
        `"${d.division || ""}"`,
        `"${d.batch || ""}"`,
        `"${pct}%"`,
        pct < 50 ? `"CRITICAL DEFAULTER"` : `"WARNING DEFAULTER"`,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e: any) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `charusat_defaulters_radar_${threshold}pct_${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${filteredDefaulters.length} defaulter records to CSV.`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* =========================================================================
          PRINT ONLY VIEW: Formal CHARUSAT Institutional Circular
          Hidden on screen, rendered exclusively when window.print() is invoked
          ========================================================================= */}
      <div className="hidden print:block font-serif text-black p-8 bg-white max-w-4xl mx-auto space-y-6">
        {/* Letterhead */}
        <div className="text-center border-b-2 border-black pb-4 space-y-1">
          <h1 className="text-xl font-bold tracking-tight uppercase">
            Charotar University of Science and Technology (CHARUSAT)
          </h1>
          <p className="text-xs uppercase font-medium tracking-wide">
            Faculty of Technology &amp; Applied Sciences • Academic Examination Affairs
          </p>
          <div className="pt-2">
            <span className="text-sm font-bold uppercase tracking-wider underline">
              Official Defaulters Circular &bull; Term Journal Compliance
            </span>
          </div>
        </div>

        {/* Circular Metadata */}
        <div className="flex justify-between text-xs py-2 border-b border-gray-300">
          <div>
            <p><strong>Notice No:</strong> CHARUSAT/EXAM/DEF/{new Date().getFullYear()}/04</p>
            <p><strong>Minimum Required Journal Threshold:</strong> {threshold}% Completion</p>
            {selectedClassroomId && (
              <p><strong>Course Filter:</strong> {classroomsData?.classrooms?.find((c: any) => c.id === selectedClassroomId)?.name || "Specific Course"}</p>
            )}
          </div>
          <div className="text-right">
            <p><strong>Date:</strong> {formatDateIST(new Date().toISOString())}</p>
            <p><strong>Academic Cycle:</strong> Active Term Records</p>
          </div>
        </div>

        {/* Narrative Directive */}
        <p className="text-xs leading-relaxed text-justify">
          The following students have failed to attain the mandatory minimum practical journal completion requirement
          of <strong>{threshold}%</strong> in continuous lab assessments. In accordance with university academic regulations,
          students flagged as <strong>Critical Defaulter</strong> are subject to examination detention unless remediation
          is completed under faculty supervision prior to term conclusion.
        </p>

        {/* Defaulters Table (Print) */}
        <table className="w-full text-xs border-collapse border border-black mt-4">
          <thead>
            <tr className="bg-gray-100 border-b border-black text-left">
              <th className="p-2 border-r border-black w-10 text-center">#</th>
              <th className="p-2 border-r border-black w-24">Enrollment</th>
              <th className="p-2 border-r border-black">Student Name</th>
              <th className="p-2 border-r border-black w-20">Batch</th>
              <th className="p-2 border-r border-black w-24 text-right">Completion</th>
              <th className="p-2 w-28 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredDefaulters.map((s: any, idx: number) => {
              const pct = s.completionRate ?? s.overallCompletionPercentage ?? 0;
              return (
                <tr key={s.studentId ? `print-${s.studentId}` : `print-${idx}`} className="border-b border-gray-300">
                  <td className="p-2 border-r border-black text-center">{idx + 1}</td>
                  <td className="p-2 border-r border-black font-mono font-bold">{s.enrollmentNumber}</td>
                  <td className="p-2 border-r border-black">{s.name}</td>
                  <td className="p-2 border-r border-black">
                    {s.department ? `${s.department} • ` : ""}Batch {s.batch || "—"}
                  </td>
                  <td className="p-2 border-r border-black text-right font-mono font-bold">
                    {pct}%
                  </td>
                  <td className="p-2 text-center font-bold">
                    {pct < 50 ? "DEBARRED" : "WARNING"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Signature Blocks */}
        <div className="pt-16 grid grid-cols-3 gap-6 text-center text-xs font-semibold">
          <div className="border-t border-black pt-2">
            <p>Course Coordinator</p>
            <p className="text-[10px] text-gray-500 font-normal">Department of CE/IT</p>
          </div>
          <div className="border-t border-black pt-2">
            <p>Head of Department</p>
            <p className="text-[10px] text-gray-500 font-normal">Faculty of Technology</p>
          </div>
          <div className="border-t border-black pt-2">
            <p>Dean / Principal</p>
            <p className="text-[10px] text-gray-500 font-normal">CHARUSAT Campus</p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SCREEN INTERACTIVE VIEW: Defaulters Radar Executive Cockpit
          ========================================================================= */}
      <div className="print:hidden space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Continuous Assessment Radar
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-muted text-muted-foreground border border-border">
                Mandatory &ge; 75% Rule
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground mt-1">
              Academic Defaulters Radar
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              High-throughput aggregation identifying students falling below institutional practical journal thresholds
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredDefaulters.length === 0}
              className="rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <Download className="size-3.5" />
              <span>Export CSV</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={filteredDefaulters.length === 0}
              className="rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <Printer className="size-3.5" />
              <span>Print Circular</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Executive Metric Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <Users className="size-3.5 text-blue-500" />
              Total Evaluated
            </span>
            <p className="text-2xl font-black text-foreground tabular-nums">
              {totalEvaluated}
            </p>
            <p className="text-[10px] text-muted-foreground">Students in active courses</p>
          </div>

          <div className="p-4 rounded-3xl bg-card border border-amber-500/30 shadow-xs space-y-1">
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" />
              Defaulters Identified
            </span>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {defaultersCount}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Below {threshold}% journal completion
            </p>
          </div>

          <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <Activity className="size-3.5 text-rose-500" />
              Institutional Defaulter Rate
            </span>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
              {defaulterRate}%
            </p>
            <p className="text-[10px] text-muted-foreground">Of enrolled student cohort</p>
          </div>

          <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              Compliance Index
            </span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {(100 - parseFloat(defaulterRate)).toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">Exam eligibility standing</p>
          </div>
        </div>

        {/* Filter Controls Strip */}
        <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Threshold Slider */}
            <div className="md:col-span-5 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-foreground flex items-center gap-1.5">
                  <Sliders className="size-3.5 text-primary" />
                  Completion Threshold:
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-mono font-black text-sm">
                  {threshold}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="95"
                step="5"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex items-center gap-1.5 pt-0.5">
                {[50, 65, 75, 80].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setThreshold(t)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                      threshold === t
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {t}% {t === 75 ? "(Standard)" : ""}
                  </button>
                ))}
              </div>
            </div>

            {/* Course Filter */}
            <div className="md:col-span-4 space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <BookOpen className="size-3.5 text-emerald-500" />
                Target Course / Lab:
              </label>
              <CustomSelect
                value={selectedClassroomId}
                onChange={(val) => setSelectedClassroomId(val)}
                options={[
                  { value: "", label: "-- All Active Practical Courses --" },
                  ...(classroomsData?.classrooms?.map((c: any) => ({
                    value: c.id,
                    label: `${c.name} (${c.subjectCode || "LAB"})`,
                  })) || []),
                ]}
                placeholder="-- All Active Practical Courses --"
                className="w-full text-xs"
              />
            </div>

            {/* Batch Filter */}
            <div className="md:col-span-3 space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Filter className="size-3.5 text-blue-500" />
                Batch Filter:
              </label>
              <CustomSelect
                value={batchFilter}
                onChange={(val) => setBatchFilter(val)}
                options={[
                  { value: "all", label: "All Lab Batches" },
                  ...availableBatches.map((b) => ({ value: String(b), label: `Batch ${b}` })),
                ]}
                placeholder="All Lab Batches"
                className="w-full text-xs"
              />
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative pt-2 border-t border-border/40">
            <Search className="absolute left-3.5 top-1/2 translate-y-[-25%] size-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by student name, roll number (e.g. 24CS021), or email..."
              className="w-full pl-10 pr-4 py-2 rounded-2xl bg-muted/30 border border-border text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Defaulters Table Card */}
        <div className="rounded-3xl bg-card border border-border/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">Defaulters Compliance Register</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-muted text-muted-foreground border border-border">
                {filteredDefaulters.length} flagged
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Evaluated against published assignments
            </p>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
              Aggregating student journal completion records...
            </div>
          ) : filteredDefaulters.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-2">
              <CheckCircle2 className="size-8 text-emerald-500 mx-auto opacity-80" />
              <p className="text-sm font-bold text-foreground">No Defaulters Detected!</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                All enrolled students satisfy or exceed the required {threshold}% journal completion benchmark.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20 text-muted-foreground font-semibold">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Enrollment</th>
                    <th className="py-3 px-4">Cohort</th>
                    <th className="py-3 px-4">Course Breakdown</th>
                    <th className="py-3 px-4 text-right">Completion</th>
                    <th className="py-3 px-4 text-center">Eligibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredDefaulters.map((s: any, idx: number) => {
                    const pct = s.completionRate ?? s.overallCompletionPercentage ?? 0;
                    const isSevere = pct < 50;

                    return (
                      <tr key={s.studentId ? `row-${s.studentId}` : `row-${idx}`} className="hover:bg-muted/15 transition-colors">
                        {/* Student Name & Email */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-foreground leading-snug">{s.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{s.email}</div>
                        </td>

                        {/* Enrollment Number */}
                        <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                          {s.enrollmentNumber}
                        </td>

                        {/* Cohort */}
                        <td className="py-3.5 px-4 text-[11px] text-muted-foreground">
                          <div className="font-semibold text-foreground/90">{s.department || "Engineering"}</div>
                          <div>{s.semester ? `Sem ${s.semester} • ` : ""}{s.division ? `Div ${s.division} • ` : ""}Batch {s.batch || "—"}</div>
                        </td>

                        {/* Practical Completion / Classroom breakdown */}
                        <td className="py-3.5 px-4">
                          {s.totalPracticals !== undefined ? (
                            <div className="text-[11px] font-mono font-semibold text-foreground">
                              {s.approvedPracticals ?? 0} / {s.totalPracticals} practicals approved
                            </div>
                          ) : s.classrooms && s.classrooms.length > 0 ? (
                            <div className="space-y-1 max-w-xs">
                              {s.classrooms.map((cr: any, i: number) => (
                                <div key={i} className="flex items-center justify-between text-[11px] gap-2">
                                  <span className="truncate text-muted-foreground font-medium max-w-[140px]">
                                    {cr.classroomName}
                                  </span>
                                  <span className="font-mono text-foreground font-semibold shrink-0">
                                    {cr.completedJournals} / {cr.totalAssignments} ({cr.completionPercentage}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">0 submissions</span>
                          )}
                        </td>

                        {/* Overall Completion Progress */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-mono font-bold text-sm text-foreground">
                            {pct}%
                          </div>
                          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden ml-auto mt-1">
                            <div
                              className={`h-full rounded-full ${
                                isSevere ? "bg-rose-500" : "bg-amber-500"
                              }`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </td>

                        {/* Eligibility Status Badge */}
                        <td className="py-3.5 px-4 text-center">
                          {isSevere ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 inline-flex items-center gap-1">
                              <AlertTriangle className="size-2.5" /> Debarred
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                              Warning
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
      </div>
    </div>
  );
}
