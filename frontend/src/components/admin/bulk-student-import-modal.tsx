"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Trash2,
  Wand2,
  SlidersHorizontal,
  ArrowRight,
  Loader2,
  X,
  Layers,
  Sparkles,
} from "lucide-react";

import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  CHARUSAT_COLLEGES,
  CHARUSAT_DEPARTMENTS,
  SEMESTER_OPTIONS,
  CHARUSAT_UNIVERSITY_NAME,
} from "@/lib/academic-constants";

interface StagedStudent {
  id: string;
  name: string;
  enrollmentNumber: string;
  semester: number;
  department: string;
  division: string;
  batch: string;
  college: string;
  isValid: boolean;
  isComplete: boolean;
  errorMessage?: string;
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkStudentImportModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkImportModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stagedRows, setStagedRows] = useState<StagedStudent[]>([]);
  const [activeTab, setActiveTab] = useState<"upload" | "clean" | "success">("upload");
  const [successReport, setSuccessReport] = useState<any>(null);

  // Global Clean Bar states
  const [globalDept, setGlobalDept] = useState("");
  const [globalCollege, setGlobalCollege] = useState("");
  const [globalDiv, setGlobalDiv] = useState("");

  // Range Assigner states
  const [rangeBatch, setRangeBatch] = useState("A1");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  // Submission Mutation (declared at top level to satisfy Rules of Hooks)
  const importMutation = useMutation({
    mutationFn: (payload: any) => api.post<any>("/admin/students/bulk-import", payload),
    onSuccess: (res: any) => {
      setSuccessReport(res);
      setActiveTab("success");
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to commit bulk student onboarding");
    },
  });

  // CSV Parsing Engine
  const parseCSVText = (text: string) => {
    const lines = text
      .split(/\r\n|\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      toast.error("The CSV file must contain a header row and at least one student record.");
      return;
    }

    // Split line respecting quotes
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === "," && !inQuotes) {
          result.push(cur.trim().replace(/^"|"$/g, ""));
          cur = "";
        } else {
          cur += c;
        }
      }
      result.push(cur.trim().replace(/^"|"$/g, ""));
      return result;
    };

    const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));

    const nameIdx = headers.findIndex((h) => h.includes("name") || h.includes("student"));
    const enrIdx = headers.findIndex(
      (h) => h.includes("enroll") || h.includes("roll") || h === "enr" || h === "id"
    );
    const semIdx = headers.findIndex((h) => h.includes("sem"));
    const deptIdx = headers.findIndex((h) => h.includes("dept") || h.includes("department"));
    const divIdx = headers.findIndex((h) => h.includes("div"));
    const batchIdx = headers.findIndex((h) => h.includes("batch") || h.includes("lab"));
    const collegeIdx = headers.findIndex((h) => h.includes("college") || h.includes("inst"));

    if (nameIdx === -1 || enrIdx === -1) {
      toast.error("Could not find required columns. File must contain 'Name' and 'Enrollment Number' headers.");
      return;
    }

    const parsed: StagedStudent[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (cols.length === 0 || cols.every((c) => !c)) continue;

      const rawName = cols[nameIdx] || "";
      const rawEnr = (cols[enrIdx] || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const rawSem = semIdx !== -1 ? parseInt(cols[semIdx], 10) || 1 : 1;
      const rawDept = deptIdx !== -1 ? cols[deptIdx] || "" : "";
      const rawDiv = divIdx !== -1 ? cols[divIdx] || "" : "";
      const rawBatch = batchIdx !== -1 ? cols[batchIdx] || "" : "";
      const rawCollege = collegeIdx !== -1 ? cols[collegeIdx] || "" : "";

      const isValid = Boolean(rawName && rawEnr && rawSem >= 1 && rawSem <= 8);
      const isComplete = Boolean(rawDept && rawDiv && rawBatch && rawCollege);

      parsed.push({
        id: `row_${i}_${Math.random().toString(36).substring(2, 7)}`,
        name: rawName,
        enrollmentNumber: rawEnr,
        semester: rawSem,
        department: rawDept,
        division: rawDiv,
        batch: rawBatch,
        college: rawCollege,
        isValid,
        isComplete,
        errorMessage: !rawName
          ? "Missing Name"
          : !rawEnr
          ? "Missing Enrollment"
          : !rawSem
          ? "Invalid Semester"
          : undefined,
      });
    }

    if (parsed.length === 0) {
      toast.error("No valid student rows were extracted from the file.");
      return;
    }

    setStagedRows(parsed);
    setActiveTab("clean");
    toast.success(`Loaded ${parsed.length} student rows into staging.`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        parseCSVText(content);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadSampleTemplate = () => {
    const csvContent =
      "Full Name,Enrollment Number,Semester,Department,Division,Batch,College\n" +
      "Devang Patel,24CS001,3,Computer Engineering,1,A1,CSPIT\n" +
      "Aarav Shah,24CS002,3,Computer Engineering,1,A1,CSPIT\n" +
      "Diya Sharma,24CS021,3,Computer Engineering,1,A2,CSPIT\n" +
      "Rohan Verma,24CS022,3,,,,\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "ejournal_bulk_student_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Tool 1: Global Fill for Blanks
  const applyGlobalFill = () => {
    if (!globalDept && !globalCollege && !globalDiv) {
      toast.info("Select at least one field (Department, College, or Division) to apply.");
      return;
    }

    let modifiedCount = 0;
    setStagedRows((prev) =>
      prev.map((r) => {
        let changed = false;
        const updated = { ...r };
        if (globalDept && !updated.department) {
          updated.department = globalDept;
          changed = true;
        }
        if (globalCollege && !updated.college) {
          updated.college = globalCollege;
          changed = true;
        }
        if (globalDiv && !updated.division) {
          updated.division = globalDiv;
          changed = true;
        }
        if (changed) {
          modifiedCount++;
          updated.isComplete = Boolean(
            updated.department && updated.division && updated.batch && updated.college
          );
        }
        return updated;
      })
    );

    toast.success(`Applied global updates across ${modifiedCount} student rows.`);
  };

  // Tool 2: Sequential Lab Batch Range Assigner
  const applyBatchRange = () => {
    if (!rangeBatch) {
      toast.error("Please enter or select a batch name (e.g. A1).");
      return;
    }
    const cleanStart = rangeStart.trim().toUpperCase();
    const cleanEnd = rangeEnd.trim().toUpperCase();

    if (!cleanStart && !cleanEnd) {
      toast.info("Please provide at least a Start or End enrollment number.");
      return;
    }

    let matchedCount = 0;
    setStagedRows((prev) =>
      prev.map((r) => {
        const enr = r.enrollmentNumber.toUpperCase();
        let matches = true;
        if (cleanStart && enr < cleanStart) matches = false;
        if (cleanEnd && enr > cleanEnd) matches = false;

        if (matches) {
          matchedCount++;
          const updated = { ...r, batch: rangeBatch.toUpperCase() };
          updated.isComplete = Boolean(
            updated.department && updated.division && updated.batch && updated.college
          );
          return updated;
        }
        return r;
      })
    );

    toast.success(`Assigned batch '${rangeBatch.toUpperCase()}' to ${matchedCount} matching students.`);
  };

  // Update specific row cell inline
  const updateRowField = (id: string, field: keyof StagedStudent, value: any) => {
    setStagedRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        updated.isValid = Boolean(
          updated.name && updated.enrollmentNumber && updated.semester >= 1 && updated.semester <= 8
        );
        updated.isComplete = Boolean(
          updated.department && updated.division && updated.batch && updated.college
        );
        return updated;
      })
    );
  };

  const removeRow = (id: string) => {
    setStagedRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleCommitImport = () => {
    const invalidCount = stagedRows.filter((r) => !r.isValid).length;
    if (invalidCount > 0) {
      toast.error(`Please fix or remove the ${invalidCount} invalid rows with missing name/enrollment.`);
      return;
    }

    const payload = {
      students: stagedRows.map((r) => ({
        name: r.name,
        enrollmentNumber: r.enrollmentNumber,
        semester: Number(r.semester),
        department: r.department || null,
        division: r.division || null,
        batch: r.batch || null,
        college: r.college || null,
        university: CHARUSAT_UNIVERSITY_NAME,
      })),
      sendEmailInvite: true,
    };

    importMutation.mutate(payload);
  };

  const downloadCredentialsCSV = () => {
    if (!successReport?.credentials) return;
    const header = "Student Name,Enrollment Number,Official Email,Temporary Password,Account Status,Profile Complete\n";
    const rows = successReport.credentials
      .map(
        (c: any) =>
          `"${c.name}","${c.enrollmentNumber}","${c.email}","${c.temporaryPassword}","${c.status}","${c.isProfileComplete}"`
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `ejournal_credentials_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalCount = stagedRows.length;
  const completeCount = stagedRows.filter((r) => r.isValid && r.isComplete).length;
  const pendingCount = stagedRows.filter((r) => r.isValid && !r.isComplete).length;
  const invalidCount = stagedRows.filter((r) => !r.isValid).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card border border-border w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/70 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Bulk Student Onboarding & Data Staging</h2>
              <p className="text-xs text-muted-foreground">
                High-throughput cohort ingestion with automatic deterministic email derivation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "upload" && (
            <div className="space-y-6 py-4">
              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150 group"
              >
                <div className="p-4 rounded-2xl bg-card border border-border group-hover:scale-105 transition-transform mb-3 shadow-xs">
                  <Upload className="size-8 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Click to upload or drag & drop cohort roster</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Upload university enrollment spreadsheets in <code className="text-primary font-semibold font-mono">.csv</code> format
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Information Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-primary">
                    <Sparkles className="size-4" />
                    <span>Deterministic Email Derivation</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Spreadsheets <strong>do not need</strong> an email column. eJournal synthesizes official CHARUSAT emails automatically:{" "}
                    <code className="text-foreground font-mono font-semibold">[enrollment]@charusat.edu.in</code>.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Layers className="size-4 text-amber-500" />
                    <span>Two-Tier Profile State Machine</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Rows with missing lab batches or constituent colleges are safely onboarded as{" "}
                    <code className="text-amber-600 font-mono font-semibold">pending_setup</code>. Students self-complete their profile on initial login.
                  </p>
                </div>
              </div>

              {/* Template Download */}
              <div className="flex items-center justify-between p-4 rounded-2xl border border-border/80 bg-card">
                <div className="text-xs">
                  <span className="font-semibold text-foreground">Need a standardized starting roster?</span>
                  <p className="text-muted-foreground">Download our pre-formatted template with all academic headers.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadSampleTemplate}
                  className="rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
                >
                  <Download className="size-3.5" />
                  <span>Download Sample CSV</span>
                </Button>
              </div>
            </div>
          )}

          {activeTab === "clean" && (
            <div className="space-y-5">
              {/* Status Header Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-card border border-border/80 shadow-2xs">
                  <span className="text-[11px] font-bold text-muted-foreground">Total Parsed</span>
                  <p className="text-lg font-black text-foreground">{totalCount}</p>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-2xs">
                  <span className="text-[11px] font-bold text-emerald-600">Profile Complete</span>
                  <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{completeCount}</p>
                </div>
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-2xs">
                  <span className="text-[11px] font-bold text-amber-600">Partial Fields</span>
                  <p className="text-lg font-black text-amber-700 dark:text-amber-400">{pendingCount}</p>
                </div>
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 shadow-2xs">
                  <span className="text-[11px] font-bold text-rose-600">Missing / Invalid</span>
                  <p className="text-lg font-black text-rose-700 dark:text-rose-400">{invalidCount}</p>
                </div>
              </div>

              {/* Data Cleaning Tools Box */}
              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Wand2 className="size-4 text-primary" />
                  <span>Smart Cohort Cleaning & Range Tools</span>
                </div>

                {/* Tool 1: Apply to All Blanks */}
                <div className="p-3 rounded-xl bg-card border border-border/80 space-y-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                    Tool 1: Global Fill for Empty Fields (Department / College / Division)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <CustomSelect
                      value={globalDept}
                      onChange={setGlobalDept}
                      options={[{ value: "", label: "Select Department" }, ...CHARUSAT_DEPARTMENTS]}
                      placeholder="Select Department"
                      className="text-xs"
                    />
                    <CustomSelect
                      value={globalCollege}
                      onChange={setGlobalCollege}
                      options={[{ value: "", label: "Select College" }, ...CHARUSAT_COLLEGES]}
                      placeholder="Select College"
                      className="text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Division (e.g. 1)"
                      value={globalDiv}
                      onChange={(e) => setGlobalDiv(e.target.value)}
                      className="h-9 px-3 rounded-xl border border-input bg-card text-xs focus:outline-none focus:border-primary font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={applyGlobalFill}
                      className="h-9 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer bg-primary/5 hover:bg-primary/10 text-primary border-primary/20"
                    >
                      <Sparkles className="size-3.5" />
                      <span>Apply to Blanks</span>
                    </Button>
                  </div>
                </div>

                {/* Tool 2: Sequential Lab Batch Range Assigner */}
                <div className="p-3 rounded-xl bg-card border border-border/80 space-y-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                    Tool 2: Sequential Lab Batch Range Assigner (e.g. 24CS001 to 24CS020 &rarr; A1)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="Batch (e.g. A1, B2)"
                      value={rangeBatch}
                      onChange={(e) => setRangeBatch(e.target.value.toUpperCase())}
                      className="h-9 px-3 rounded-xl border border-input bg-card text-xs uppercase font-mono font-bold focus:outline-none focus:border-primary"
                    />
                    <input
                      type="text"
                      placeholder="Start Enr (e.g. 24CS001)"
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value.toUpperCase())}
                      className="h-9 px-3 rounded-xl border border-input bg-card text-xs uppercase font-mono focus:outline-none focus:border-primary"
                    />
                    <input
                      type="text"
                      placeholder="End Enr (e.g. 24CS020)"
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value.toUpperCase())}
                      className="h-9 px-3 rounded-xl border border-input bg-card text-xs uppercase font-mono focus:outline-none focus:border-primary"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={applyBatchRange}
                      className="h-9 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer bg-primary/5 hover:bg-primary/10 text-primary border-primary/20"
                    >
                      <SlidersHorizontal className="size-3.5" />
                      <span>Assign Range</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Editable Staging Table */}
              <div className="rounded-2xl border border-border/80 overflow-hidden bg-card">
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border sticky top-0 text-[11px] font-bold text-muted-foreground uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Student Name</th>
                        <th className="py-2.5 px-3">Enrollment</th>
                        <th className="py-2.5 px-2">Sem</th>
                        <th className="py-2.5 px-3">Department</th>
                        <th className="py-2.5 px-2">Div</th>
                        <th className="py-2.5 px-2">Batch</th>
                        <th className="py-2.5 px-3">College</th>
                        <th className="py-2.5 px-2 text-right">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {stagedRows.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-2 px-3 whitespace-nowrap">
                            {!r.isValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600">
                                <AlertCircle className="size-3" />
                                Invalid
                              </span>
                            ) : r.isComplete ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                                <CheckCircle2 className="size-3" />
                                Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600">
                                <AlertTriangle className="size-3" />
                                Partial
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={r.name}
                              onChange={(e) => updateRowField(r.id, "name", e.target.value)}
                              className="w-full px-2 py-1 rounded-md border border-transparent hover:border-input focus:border-primary bg-transparent text-xs font-medium"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={r.enrollmentNumber}
                              onChange={(e) => updateRowField(r.id, "enrollmentNumber", e.target.value.toUpperCase())}
                              className="w-28 px-2 py-1 rounded-md border border-transparent hover:border-input focus:border-primary bg-transparent text-xs font-mono font-semibold uppercase"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min={1}
                              max={8}
                              value={r.semester}
                              onChange={(e) => updateRowField(r.id, "semester", parseInt(e.target.value, 10) || 1)}
                              className="w-12 px-2 py-1 rounded-md border border-transparent hover:border-input focus:border-primary bg-transparent text-xs font-mono text-center"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="Empty (Pending)"
                              value={r.department}
                              onChange={(e) => updateRowField(r.id, "department", e.target.value)}
                              className="w-full px-2 py-1 rounded-md border border-transparent hover:border-input focus:border-primary bg-transparent text-xs placeholder:text-muted-foreground/40"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              placeholder="-"
                              value={r.division}
                              onChange={(e) => updateRowField(r.id, "division", e.target.value)}
                              className="w-10 px-2 py-1 rounded-md border border-transparent hover:border-input focus:border-primary bg-transparent text-xs text-center font-mono placeholder:text-muted-foreground/40"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              placeholder="-"
                              value={r.batch}
                              onChange={(e) => updateRowField(r.id, "batch", e.target.value.toUpperCase())}
                              className="w-12 px-2 py-1 rounded-md border border-transparent hover:border-input focus:border-primary bg-transparent text-xs text-center font-mono font-bold uppercase placeholder:text-muted-foreground/40"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="Empty (Pending)"
                              value={r.college}
                              onChange={(e) => updateRowField(r.id, "college", e.target.value)}
                              className="w-full px-2 py-1 rounded-md border border-transparent hover:border-input focus:border-primary bg-transparent text-xs placeholder:text-muted-foreground/40"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <button
                              onClick={() => removeRow(r.id)}
                              className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "success" && successReport && (
            <div className="py-6 text-center space-y-5">
              <div className="size-14 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="size-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground">Cohort Successfully Onboarded!</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Accounts have been provisioned in the central university registry and welcome emails are dispatching.
                </p>
              </div>

              {/* Metrics Pill Grid */}
              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-center">
                <div className="p-3 rounded-2xl bg-muted/40 border border-border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Accounts Provisioned</span>
                  <p className="text-lg font-black text-foreground">{successReport.totalCreated}</p>
                </div>
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-[10px] font-bold text-amber-600 uppercase">Setup Pending (Invited)</span>
                  <p className="text-lg font-black text-amber-600">{successReport.pendingSetupCount || successReport.totalCreated}</p>
                </div>
              </div>

              {/* Credentials Download Callout */}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 max-w-lg mx-auto space-y-3">
                <div className="text-xs text-muted-foreground">
                  <span className="font-bold text-foreground">Immediate Offline Backup</span>
                  <p className="mt-0.5">
                    Download the temporary credentials roster containing generated passwords to assist students in labs.
                  </p>
                </div>
                <Button
                  onClick={downloadCredentialsCSV}
                  className="rounded-xl text-xs font-bold gap-2 cursor-pointer shadow-sm w-full"
                >
                  <Download className="size-4" />
                  <span>Download Credentials Roster (.csv)</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-border/70 bg-muted/20 flex items-center justify-between">
          {activeTab === "clean" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStagedRows([]);
                  setActiveTab("upload");
                }}
                disabled={importMutation.isPending}
                className="rounded-xl text-xs font-semibold cursor-pointer"
              >
                Upload Different File
              </Button>

              <Button
                size="sm"
                onClick={handleCommitImport}
                disabled={importMutation.isPending || invalidCount > 0 || stagedRows.length === 0}
                className="rounded-xl text-xs font-bold gap-2 cursor-pointer"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Provisioning Accounts...</span>
                  </>
                ) : (
                  <>
                    <span>Commit Onboarding ({stagedRows.length} Students)</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </>
          ) : activeTab === "success" ? (
            <Button
              onClick={onClose}
              className="ml-auto rounded-xl text-xs font-bold px-6 cursor-pointer"
            >
              Close
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="ml-auto rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

