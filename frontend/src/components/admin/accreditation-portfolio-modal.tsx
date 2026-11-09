"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import JSZip from "jszip";
import {
  Award,
  Download,
  FileSpreadsheet,
  FolderArchive,
  Loader2,
  X,
  CheckCircle2,
  AlertTriangle,
  Building,
  UserCheck,
  BookOpen,
  Layers,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { formatDateIST } from "@/lib/date";

interface AccreditationPortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroom: {
    id: string;
    name: string;
    subjectCode?: string;
    teacherName?: string;
  } | null;
}

export function AccreditationPortfolioModal({
  isOpen,
  onClose,
  classroom,
}: AccreditationPortfolioModalProps) {
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");

  const { data: portfolioData, isLoading } = useQuery<any>({
    queryKey: ["accreditation-portfolio-data", classroom?.id],
    queryFn: () => api.get(`/admin/classrooms/${classroom?.id}/portfolio-data`),
    enabled: isOpen && !!classroom?.id,
  });

  if (!isOpen || !classroom) return null;

  const evaluationMatrix: any[] = portfolioData?.evaluationMatrix || [];
  const topTier: any[] = portfolioData?.topTierJournals || [];
  const midTier: any[] = portfolioData?.midTierJournals || [];
  const lowTier: any[] = portfolioData?.lowTierJournals || [];
  const totalStudents = portfolioData?.totalStudents ?? evaluationMatrix.length;
  const topCount = portfolioData?.topTierCount ?? (totalStudents > 0 ? Math.max(1, Math.round(totalStudents * 0.10)) : 0);
  const midCount = portfolioData?.midTierCount ?? topCount;
  const lowCount = portfolioData?.lowTierCount ?? topCount;

  const handleDownloadZip = async () => {
    if (!portfolioData) {
      toast.error("Portfolio data not ready.");
      return;
    }

    try {
      setIsZipping(true);
      setZipProgress(10);
      setProgressStatus("Initializing in-browser ZIP packaging...");

      const zip = new JSZip();
      const folderName = `NBA_NAAC_Portfolio_${classroom.subjectCode || "LAB"}_${new Date().getFullYear()}`;
      const rootFolder = zip.folder(folderName) || zip;

      // 1. Generate MASTER_EVALUATION_MATRIX.csv
      setZipProgress(25);
      setProgressStatus("Compiling Master Continuous Evaluation Matrix...");

      const headers = [
        "Enrollment Number",
        "Student Name",
        "Department",
        "Division",
        "Batch",
        "Total Practicals Submitted",
        "Total Marks Obtained",
        "Max Possible Marks",
        "Percentage",
        "Accreditation Sampling Tier",
      ];

      const csvRows = evaluationMatrix.map((s, idx) => {
        let tier = "General Cohort";
        const total = evaluationMatrix.length;
        const sampleCount = Math.max(1, Math.round(total * 0.10));
        if (idx < sampleCount) tier = "TOP 10% SAMPLE";
        else if (idx >= total - sampleCount) tier = "LOW 10% SAMPLE";
        else {
          const midStart = Math.max(0, Math.floor(total / 2) - Math.floor(sampleCount / 2));
          if (idx >= midStart && idx < midStart + sampleCount) tier = "MID 10% SAMPLE";
        }

        return [
          `"${s.enrollmentNumber || ""}"`,
          `"${s.name || ""}"`,
          `"${s.department || ""}"`,
          `"${s.division || ""}"`,
          `"${s.batch || ""}"`,
          `"${s.journalsCount || 0}"`,
          `"${s.totalMarks || 0}"`,
          `"${s.maxPossibleMarks || 0}"`,
          `"${s.percentage || 0}%"`,
          `"${tier}"`,
        ].join(",");
      });

      const csvContent = [headers.join(","), ...csvRows].join("\n");
      rootFolder.file("MASTER_EVALUATION_MATRIX.csv", csvContent);

      // 2. Generate Institutional Audit Narrative
      setZipProgress(40);
      setProgressStatus("Writing Institutional NAAC / NBA Audit Metadata...");

      const auditSummary = `CHAROTAR UNIVERSITY OF SCIENCE AND TECHNOLOGY (CHARUSAT)
FACULTY OF TECHNOLOGY & APPLIED SCIENCES
CONTINUOUS INTERNAL EVALUATION (CIE) ACCREDITATION AUDIT PACKAGE

Course Name: ${portfolioData.classroomName}
Subject Code: ${portfolioData.subjectCode}
Faculty Instructor: ${portfolioData.teacherName}
Academic Term: ${portfolioData.academicTerm}
Export Generation Date: ${formatDateIST(new Date().toISOString())}

AUDIT SAMPLING DIRECTIVE (NBA CRITERION 2.2 & NAAC METRIC 2.6.2):
This portfolio contains official academic journal submissions from three representative student cohorts:
1. TOP 10% COHORT: Exemplary lab journals demonstrating mastery of practical course outcomes.
2. MID 10% COHORT: Median representative performance reflecting mainstream class achievement.
3. LOW 10% COHORT: Minimal passing compliance showing areas for continuous academic improvement.

Cohort Summary:
- Total Enrolled Students: ${portfolioData.totalStudents}
- Total Lab Practicals: ${portfolioData.totalAssignments}
- Top 10% Sample Count: ${topTier.length} documents
- Mid 10% Sample Count: ${midTier.length} documents
- Low 10% Sample Count: ${lowTier.length} documents
`;
      rootFolder.file("ACCREDITATION_AUDIT_REPORT.txt", auditSummary);

      // Helper function to format journal blocks into clean HTML/Text
      const formatJournalDocument = (j: any) => {
        const blocks = j.blocks || [];
        const renderedBlocks = blocks
          .map((b: any, bIdx: number) => {
            const type = b.type;
            const content = b.content || {};
            if (type === "code") {
              return `<h3>Block #${bIdx + 1}: Code Snippet</h3><pre style="background:#f4f4f4;padding:10px;border-radius:6px;font-family:monospace;">${content.code || ""}</pre>`;
            }
            if (type === "table") {
              const rows = (content.rows || [])
                .map(
                  (r: any) =>
                    `<tr>${(Array.isArray(r) ? r : Object.values(r))
                      .map((c: any) => `<td style="border:1px solid #ccc;padding:6px;">${String(c)}</td>`)
                      .join("")}</tr>`
                )
                .join("");
              return `<h3>Block #${bIdx + 1}: Observations & Data Table</h3><table style="border-collapse:collapse;width:100%;margin:10px 0;">${rows}</table>`;
            }
            if (type === "math") {
              return `<h3>Block #${bIdx + 1}: Formula / Derivation</h3><div style="background:#f9f9f9;padding:8px;font-family:monospace;">${content.latex || content.formula || content.text || ""}</div>`;
            }
            return `<p>${content.text || ""}</p>`;
          })
          .join("\n");

        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${j.assignmentTitle} - ${j.studentName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, serif; padding: 40px; color: #111; max-width: 800px; margin: auto; }
    .header { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
    h1 { font-size: 18px; margin: 0 0 5px 0; }
    .meta { font-size: 12px; color: #555; }
    .grade-box { float: right; border: 1px solid #000; padding: 10px 15px; text-align: center; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div class="grade-box">
      Score: ${j.marks ?? "—"} / ${j.maxMarks || 10}
    </div>
    <h1>Charotar University of Science and Technology</h1>
    <div class="meta">
      <strong>Student:</strong> ${j.studentName} (${j.enrollmentNumber})<br />
      <strong>Experiment:</strong> ${j.assignmentTitle}<br />
      <strong>Teacher Remarks:</strong> ${j.teacherRemarks || "Satisfactory completion"}<br />
    </div>
  </div>
  ${renderedBlocks}
</body>
</html>`;
      };

      // 3. Add Top 10% Folder
      setZipProgress(60);
      setProgressStatus("Packaging Top 10% Sample Journals...");
      const topFolder = rootFolder.folder("TOP_10_PERCENT");
      topTier.forEach((j) => {
        const cleanName = `${j.enrollmentNumber}_${(j.assignmentTitle || "practical").replace(/[^a-zA-Z0-9]/g, "_")}.html`;
        topFolder?.file(cleanName, formatJournalDocument(j));
      });

      // 4. Add Mid 10% Folder
      setZipProgress(75);
      setProgressStatus("Packaging Mid 10% Sample Journals...");
      const midFolder = rootFolder.folder("MID_10_PERCENT");
      midTier.forEach((j) => {
        const cleanName = `${j.enrollmentNumber}_${(j.assignmentTitle || "practical").replace(/[^a-zA-Z0-9]/g, "_")}.html`;
        midFolder?.file(cleanName, formatJournalDocument(j));
      });

      // 5. Add Low 10% Folder
      setZipProgress(90);
      setProgressStatus("Packaging Low 10% Sample Journals...");
      const lowFolder = rootFolder.folder("LOW_10_PERCENT");
      lowTier.forEach((j) => {
        const cleanName = `${j.enrollmentNumber}_${(j.assignmentTitle || "practical").replace(/[^a-zA-Z0-9]/g, "_")}.html`;
        lowFolder?.file(cleanName, formatJournalDocument(j));
      });

      // 6. Generate ZIP Blob in browser memory (Zero server disk / 0% server CPU!)
      setProgressStatus("Compressing archive into browser memory...");
      const zipBlob = await zip.generateAsync({ type: "blob" });

      setZipProgress(100);
      setProgressStatus("Download complete!");

      // Trigger native browser download
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NBA_NAAC_Portfolio_${classroom.subjectCode || "LAB"}_${new Date().getFullYear()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(
        `Accreditation Portfolio package downloaded successfully (~${(zipBlob.size / 1024).toFixed(1)} KB).`,
        { title: "📦 Portfolio Exported" }
      );
      setTimeout(() => {
        setIsZipping(false);
        setZipProgress(0);
        onClose();
      }, 600);
    } catch (err: any) {
      console.error("ZIP Generation error:", err);
      toast.error(err.message || "Failed to package accreditation portfolio.");
      setIsZipping(false);
      setZipProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-50 duration-150">
      <div className="w-full max-w-xl rounded-3xl bg-card border border-border p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute -top-16 -right-16 size-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold shrink-0">
              <Award className="size-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                Accreditation &amp; Audit Suite
              </span>
              <h3 className="text-base font-black text-foreground">
                NBA / NAAC Course Portfolio Exporter
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Course Summary */}
        <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground text-sm">{classroom.name}</span>
            <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-background text-foreground border border-border">
              {classroom.subjectCode || "LAB"}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span>Instructor: {portfolioData?.teacherName || classroom.teacherName || "Faculty"}</span>
            <span>Enrolled Students: <strong className="text-foreground">{totalStudents}</strong></span>
          </div>
        </div>

        {/* Sampling Tier Distribution Preview */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Layers className="size-3.5 text-indigo-500" />
            Accreditation Sampling Cohorts (NBA Criterion 2.2):
          </label>
          <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                Top 10%
              </span>
              <p className="text-lg font-black text-foreground mt-0.5">
                {topCount} <span className="text-[11px] font-medium text-muted-foreground">students</span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                {topTier.length} practicals • High Exemplars
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
              <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">
                Mid 10%
              </span>
              <p className="text-lg font-black text-foreground mt-0.5">
                {midCount} <span className="text-[11px] font-medium text-muted-foreground">students</span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                {midTier.length} practicals • Median Samples
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                Low 10%
              </span>
              <p className="text-lg font-black text-foreground mt-0.5">
                {lowCount} <span className="text-[11px] font-medium text-muted-foreground">students</span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                {lowTier.length} practicals • Passing Threshold
              </p>
            </div>
          </div>
        </div>

        {/* Packaging Notice */}
        <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 text-[11px] text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <FileSpreadsheet className="size-3.5 text-emerald-500" />
            Package Structure:
          </p>
          <p>
            Includes <code>MASTER_EVALUATION_MATRIX.csv</code> (complete grade distribution), formal
            audit metadata, and rendered HTML journal portfolios organized into Top/Mid/Low tier folders.
          </p>
        </div>

        {/* Progress Bar (Visible while zipping) */}
        {isZipping && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-muted-foreground">{progressStatus}</span>
              <span className="font-mono text-primary">{zipProgress}%</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${zipProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isZipping}
            className="rounded-xl text-xs font-semibold cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={handleDownloadZip}
            disabled={isZipping || isLoading}
            className="rounded-xl text-xs font-bold gap-2 cursor-pointer shadow-md bg-indigo-600 text-white hover:bg-indigo-700"
          >
            {isZipping ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Packaging ZIP...
              </>
            ) : isLoading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Loading Course Matrix...
              </>
            ) : (
              <>
                <Download className="size-3.5" />
                Download Portfolio ZIP
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

