"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  Search,
  Sliders,
  Filter,
  Play,
  FileText,
  Split,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Code,
  Table as TableIcon,
  AlignLeft,
  Binary,
  Calendar,
  BookOpen,
  ArrowRight,
  Sparkles,
} from "lucide-react";

import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { formatDateIST, formatDateTimeIST } from "@/lib/date";
import { SideBySideComparisonDrawer } from "@/components/admin/side-by-side-comparison-drawer";

export default function AcademicIntegrityPage() {
  const queryClient = useQueryClient();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [scanThreshold, setScanThreshold] = useState(0.50);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [search, setSearch] = useState("");

  // 1. Fetch Classrooms for scan selector
  const { data: classroomsData } = useQuery<any>({
    queryKey: ["admin-classrooms-integrity"],
    queryFn: () => api.get("/admin/classrooms?limit=100"),
  });

  // 2. Fetch Assignments for chosen classroom
  const { data: assignmentsData } = useQuery<any>({
    queryKey: ["admin-assignments-integrity", selectedClassroomId],
    queryFn: () => api.get(`/classrooms/${selectedClassroomId}/assignments`),
    enabled: !!selectedClassroomId,
  });

  // 3. Fetch Historical Reports
  const { data: reportsData, isLoading: reportsLoading, refetch: refetchReports, isRefetching } = useQuery<any>({
    queryKey: ["admin-similarity-reports"],
    queryFn: () => api.get("/admin/similarity/reports?limit=50"),
  });

  const reports: any[] = reportsData?.reports || [];
  const activeReportId = selectedReportId || (reports.length > 0 ? reports[0].id : null);

  // 4. Fetch Active Report Details
  const { data: activeReport, isLoading: reportLoading } = useQuery<any>({
    queryKey: ["admin-similarity-report", activeReportId],
    queryFn: () => api.get(`/admin/similarity/reports/${activeReportId}`),
    enabled: !!activeReportId,
  });

  // 5. Scan Mutation
  const scanMutation = useMutation({
    mutationFn: (payload: { classroomId?: string; assignmentId?: string; threshold: number }) =>
      api.post<any>("/admin/similarity/scan", payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-similarity-reports"] });
      setSelectedReportId(data.id);
      setShowScanModal(false);
      if (data.totalSubmissions === 0) {
        toast.info("Scan completed: 0 student submissions found in this course to compare.", {
          title: "ℹ️ No Submissions Found",
        });
      } else if (data.flaggedPairsCount === 0) {
        toast.success(`Scan complete! All ${data.totalSubmissions} submissions are original.`, {
          title: "✅ No Plagiarism Detected",
        });
      } else {
        toast.success(
          `Similarity scan complete! ${data.flaggedPairsCount} suspicious pairs flagged.`,
          { title: "🔍 Integrity Screener Finished" }
        );
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to execute similarity scan.");
    },
  });

  const handleStartScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassroomId && !selectedAssignmentId) {
      toast.error("Please choose a target classroom or assignment.");
      return;
    }
    scanMutation.mutate({
      classroomId: selectedClassroomId || undefined,
      assignmentId: selectedAssignmentId || undefined,
      threshold: scanThreshold,
    });
  };

  const matches = activeReport?.matches || [];
  const filteredMatches = matches.filter((m: any) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      m.studentA?.name?.toLowerCase().includes(q) ||
      m.studentA?.enrollment?.toLowerCase().includes(q) ||
      m.studentB?.name?.toLowerCase().includes(q) ||
      m.studentB?.enrollment?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              Academic Integrity Suite
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-muted text-muted-foreground border border-border">
              Multi-Block Winnowing Engine
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground mt-1">
            Cross-Journal Similarity Screener
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Detect cross-student plagiarism across code, numeric tables, mathematical equations, and paragraphs
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            onClick={() => setShowScanModal(true)}
            className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer bg-primary text-primary-foreground shadow-xs"
          >
            <Play className="size-3.5 fill-current" />
            <span>Run New Scan</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchReports()}
            disabled={isRefetching}
            className="rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Main Grid: Left sidebar (Historical Reports list) + Right Content (Active Report Details) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Historical Reports List */}
        <div className="lg:col-span-4 rounded-3xl bg-card border border-border/80 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Scan Reports ({reports.length})
            </h3>
            <span className="text-[10px] text-muted-foreground">Historical records</span>
          </div>

          {reportsLoading ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              <Loader2 className="size-4 animate-spin mx-auto mb-2 text-primary" />
              Loading past scans...
            </div>
          ) : reports.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs space-y-2">
              <ShieldAlert className="size-6 text-muted-foreground/60 mx-auto" />
              <p>No similarity scans run yet.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowScanModal(true)}
                className="rounded-xl text-xs font-semibold cursor-pointer"
              >
                Launch First Scan
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {reports.map((r: any) => {
                const isSelected = r.id === activeReportId;
                const hasFlags = (r.flaggedPairsCount || 0) > 0;

                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedReportId(r.id)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? "bg-primary/10 border-primary text-foreground shadow-xs"
                        : "bg-muted/20 hover:bg-muted/40 border-border/50 text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-foreground line-clamp-1">
                        {r.assignmentTitle || r.classroomName || "Course Practical Scan"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                          hasFlags
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        }`}
                      >
                        {r.flaggedPairsCount || 0} flagged
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{r.classroomName || "Classroom"}</span>
                      <span>{formatDateIST(r.generatedAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Report Analysis */}
        <div className="lg:col-span-8 space-y-4">
          {reportLoading ? (
            <div className="p-16 rounded-3xl bg-card border border-border/80 text-center text-muted-foreground text-xs">
              <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
              Loading report analysis &amp; student pairs...
            </div>
          ) : !activeReport ? (
            <div className="p-16 rounded-3xl bg-card border border-border/80 text-center text-muted-foreground text-xs">
              Select or generate an integrity scan to view flagged student pairs.
            </div>
          ) : (
            <>
              {/* Executive Metrics Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Total Submissions
                  </span>
                  <p className="text-xl font-black text-foreground tabular-nums">
                    {activeReport.totalSubmissions}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Journals cross-evaluated</p>
                </div>

                <div className="p-4 rounded-3xl bg-card border border-rose-500/30 shadow-xs space-y-1">
                  <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    Flagged Pairs
                  </span>
                  <p className="text-xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                    {activeReport.flaggedPairsCount}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Similarity &ge; {Math.round(activeReport.threshold * 100)}%
                  </p>
                </div>

                <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-xs space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Max Similarity
                  </span>
                  <p className="text-xl font-black text-foreground tabular-nums">
                    {matches.length > 0 ? `${Math.round(matches[0].overallSimilarity * 100)}%` : "0%"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Highest detected match</p>
                </div>
              </div>

              {/* Flagged Pairs Table Card */}
              <div className="rounded-3xl bg-card border border-border/80 shadow-xs overflow-hidden space-y-4 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Suspicious Duplicate Submissions
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Click &quot;Compare Side-by-Side&quot; to inspect matching code and observations
                    </p>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filter student name or roll..."
                      className="pl-8 pr-3 py-1.5 rounded-xl bg-muted/40 border border-border text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none w-56"
                    />
                  </div>
                </div>

                {activeReport.totalSubmissions === 0 ? (
                  <div className="py-12 text-center text-muted-foreground space-y-2">
                    <ShieldAlert className="size-8 text-amber-500 mx-auto opacity-80" />
                    <p className="text-sm font-bold text-foreground">No Submissions Found for Comparison</p>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      This classroom or assignment does not have submitted or approved student journals yet. Students must hand in their lab journals before the similarity screener can compare their work.
                    </p>
                  </div>
                ) : filteredMatches.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground space-y-2">
                    <CheckCircle2 className="size-8 text-emerald-500 mx-auto opacity-80" />
                    <p className="text-sm font-bold text-foreground">No Plagiarism Flagged</p>
                    <p className="text-xs text-muted-foreground">
                      All {activeReport.totalSubmissions} student submissions are within original, unique thresholds.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredMatches.map((m: any, idx: number) => {
                      const overallPct = Math.round(m.overallSimilarity * 100);
                      const isHigh = overallPct >= 75;

                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-2xl bg-muted/20 border border-border/60 hover:border-amber-500/40 transition-all space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            {/* Student Pair Info */}
                            <div className="flex items-center gap-3">
                              <div>
                                <span className="font-bold text-foreground text-xs">
                                  {m.studentA.name}
                                </span>
                                <span className="text-[11px] font-mono text-muted-foreground ml-1.5">
                                  ({m.studentA.enrollment})
                                </span>
                              </div>
                              <span className="text-muted-foreground font-bold">&harr;</span>
                              <div>
                                <span className="font-bold text-foreground text-xs">
                                  {m.studentB.name}
                                </span>
                                <span className="text-[11px] font-mono text-muted-foreground ml-1.5">
                                  ({m.studentB.enrollment})
                                </span>
                              </div>
                            </div>

                            {/* Overall Match Badge & Compare Action */}
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-mono font-black ${
                                  isHigh
                                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                }`}
                              >
                                {overallPct}% Match
                              </span>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedMatch(m)}
                                className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer hover:border-amber-500/40"
                              >
                                <Split className="size-3.5 text-amber-500" />
                                <span>Compare Side-by-Side</span>
                              </Button>
                            </div>
                          </div>

                          {/* Block Categories Strip */}
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-[11px]">
                            <span className="text-muted-foreground font-semibold">Breakdown:</span>
                            {Object.entries(m.categoryMatches || {}).map(([cat, sim]: [string, any]) => {
                              const catPct = Math.round(Number(sim) * 100);
                              return (
                                <span
                                  key={cat}
                                  className={`px-2 py-0.5 rounded-md font-mono font-bold text-[10px] ${
                                    catPct >= 70
                                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                      : catPct >= 40
                                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {cat}: {catPct}%
                                </span>
                              );
                            })}
                            <span className="text-muted-foreground ml-auto font-mono text-[10px]">
                              {m.matchedBlockPairs?.length || 0} duplicate blocks detected
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Side-by-Side Visual Comparison Drawer */}
      <SideBySideComparisonDrawer
        isOpen={!!selectedMatch}
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
      />

      {/* Launch New Scan Modal */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-50 duration-150">
          <div className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Play className="size-4 fill-current" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Launch Similarity Screener
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Multi-block Winnowing scan across cohort journals
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScanModal(false)}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleStartScan} className="space-y-4">
              {/* Target Classroom */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <BookOpen className="size-3.5 text-primary" />
                  Select Classroom:
                </label>
                <CustomSelect
                  value={selectedClassroomId}
                  onChange={(val) => {
                    setSelectedClassroomId(val);
                    setSelectedAssignmentId("");
                  }}
                  options={[
                    { value: "", label: "-- Choose Course --" },
                    ...(classroomsData?.classrooms?.map((c: any) => ({
                      value: c.id,
                      label: `${c.name} (${c.subjectCode || "LAB"})`,
                    })) || []),
                  ]}
                  placeholder="-- Choose Course --"
                  className="w-full text-xs"
                />
              </div>

              {/* Target Assignment (Optional) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="size-3.5 text-emerald-500" />
                  Specific Assignment (Optional):
                </label>
                <CustomSelect
                  value={selectedAssignmentId}
                  onChange={(val) => setSelectedAssignmentId(val)}
                  options={[
                    { value: "", label: "-- All Assignments in Course --" },
                    ...((Array.isArray(assignmentsData)
                      ? assignmentsData
                      : assignmentsData?.assignments || []
                    ).map((a: any) => ({
                      value: a.id,
                      label: a.title,
                    }))),
                  ]}
                  placeholder="-- All Assignments in Course --"
                  className="w-full text-xs"
                />
              </div>

              {/* Threshold Slider */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-foreground flex items-center gap-1.5">
                    <Sliders className="size-3.5 text-amber-500" />
                    Plagiarism Sensitivity Threshold:
                  </span>
                  <span className="font-mono font-bold text-primary">
                    {Math.round(scanThreshold * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.30"
                  max="0.90"
                  step="0.05"
                  value={scanThreshold}
                  onChange={(e) => setScanThreshold(parseFloat(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex items-center gap-1.5 pt-0.5">
                  {[0.40, 0.50, 0.65, 0.80].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setScanThreshold(t)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        scanThreshold === t
                          ? "bg-primary text-primary-foreground shadow-2xs"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {Math.round(t * 100)}% {t === 0.50 ? "(Recommended)" : ""}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowScanModal(false)}
                  className="rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={scanMutation.isPending || (!selectedClassroomId && !selectedAssignmentId)}
                  className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer shadow-xs"
                >
                  {scanMutation.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Screening Submissions...
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5 fill-current" />
                      Run Screener
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

