"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Printer, BookOpen, FileText, GraduationCap, ShieldCheck, CheckCircle2, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import BlockRenderer from "@/app/editor/[journalId]/block-renderer";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CompileJournalPage({ params }: PageProps) {
  const { id: classroomId } = use(params);
  const searchParams = useSearchParams();
  const targetJournalId = searchParams.get("journalId");
  const isSingleMode = Boolean(targetJournalId);

  // 1. Fetch User Profile
  const { data: user, isLoading: userLoading } = useQuery<any>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile"),
  });

  // 2. Fetch Classroom Data
  const { data: classroom, isLoading: classroomLoading } = useQuery<any>({
    queryKey: ["classroom", classroomId],
    queryFn: () => api.get(`/classrooms/${classroomId}`),
  });

  // 3. Fetch All Assignments for this classroom
  const { data: assignments, isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: ["assignments", classroomId],
    queryFn: () => api.get(`/classrooms/${classroomId}/assignments`),
  });

  // 4. Fetch All Student Journals
  const { data: journals, isLoading: journalsLoading } = useQuery<any[]>({
    queryKey: ["student-journals"],
    queryFn: () => api.get("/journals"),
  });

  // 4b. Fetch specific single journal if provided (handles teacher previewing student work)
  const { data: singleJournal, isLoading: singleJournalLoading } = useQuery<any>({
    queryKey: ["journal", targetJournalId],
    queryFn: () => api.get(`/journals/${targetJournalId}`),
    enabled: isSingleMode,
  });

  // 5. Compile and sort the practicals in sequential order
  const compiledPracticals = useMemo(() => {
    if (!assignments || assignments.length === 0) return [];

    const allJournals = [...(journals || [])];
    if (singleJournal && !allJournals.some((j) => j.id === singleJournal.id)) {
      allJournals.push(singleJournal);
    }

    // Sort assignments by experimentNumber (or creation date)
    const sortedAssignments = [...assignments].sort((a, b) => {
      if (a.experimentNumber && b.experimentNumber) {
        return a.experimentNumber - b.experimentNumber;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    let cumulativePage = 4; // Pages 1 (Cover), 2 (Certificate), 3 (Index Table)

    const list = sortedAssignments.map((asg, idx) => {
      const journal = allJournals.find((j) => j.assignmentId === asg.id);
      const estPages = journal?.blocks?.length ? Math.max(1, Math.ceil(journal.blocks.length / 4)) : 1;
      const startPage = cumulativePage;
      const endPage = cumulativePage + estPages - 1;
      cumulativePage = endPage + 1;

      return {
        index: idx + 1,
        assignment: asg,
        journal: journal || null,
        startPage,
        endPage,
        pageRange: startPage === endPage ? `${startPage}` : `${startPage} – ${endPage}`,
      };
    });

    if (isSingleMode && targetJournalId) {
      const found = list.filter((p) => p.journal?.id === targetJournalId);
      if (found.length > 0) return found;
      // If assignment wasn't in the list, construct fallback
      if (singleJournal) {
        return [
          {
            index: 1,
            assignment: {
              title: singleJournal.title || "Practical Experiment",
              aim: "To perform laboratory experiment as per instructions.",
              maxMarks: 10,
            },
            journal: singleJournal,
            startPage: 1,
            endPage: 1,
            pageRange: "1",
          },
        ];
      }
    }

    return list;
  }, [assignments, journals, singleJournal, isSingleMode, targetJournalId]);

  const isLoading =
    userLoading || classroomLoading || assignmentsLoading || journalsLoading || (isSingleMode && singleJournalLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-semibold">
          {isSingleMode ? "Preparing Lab Report for Export..." : "Compiling Master Lab Journal & Mathematical Records..."}
        </p>
      </div>
    );
  }

  const backHref = isSingleMode && targetJournalId ? `/editor/${targetJournalId}` : `/classrooms/${classroomId}`;
  const singleItem = isSingleMode ? compiledPracticals[0] : null;

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 text-foreground">
      {/* Top Navigation & Print Toolbar (Strictly hidden during print) */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 bg-background/90 backdrop-blur-xl border-b border-border shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="flex items-center justify-center size-8 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title={isSingleMode ? "Back to Editor" : "Back to Classroom"}
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
              {isSingleMode ? <FileText className="size-4 text-primary" /> : <BookOpen className="size-4 text-primary" />}
              <span>{isSingleMode ? "Official Lab Report Export" : "Master Lab Journal Compiler"}</span>
            </h1>
            <p className="text-[11px] text-muted-foreground">
              {classroom?.name || "Classroom"} •{" "}
              {isSingleMode
                ? `Experiment #${singleItem?.index || 1}: ${singleItem?.assignment?.title || "Practical"}`
                : `${compiledPracticals.length} Laboratory Practicals`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => window.print()}
            className="gap-2 bg-primary text-primary-foreground font-bold shadow-md hover:shadow-lg transition-all cursor-pointer h-9 px-4 rounded-xl"
          >
            <Printer className="size-4" />
            <span>{isSingleMode ? "Save as PDF" : "Save Master Journal as PDF"}</span>
          </Button>
        </div>
      </header>

      {/* Main Bound Academic Document Container */}
      <main className="max-w-4xl mx-auto my-8 print:my-0 p-8 sm:p-12 print:p-0 bg-white text-zinc-900 shadow-2xl print:shadow-none rounded-2xl print:rounded-none border border-border print:border-none">
        
        {/* =========================================================================
            WHOLE JOURNAL MODE ONLY: COVER PAGE, CERTIFICATE & INDEX TABLE
            ========================================================================= */}
        {!isSingleMode && (
          <>
            {/* PAGE 1: INSTITUTIONAL COVER PAGE */}
            <section className="page-break-after flex flex-col justify-between min-h-[960px] border-4 border-double border-zinc-800 p-10 sm:p-14 text-center select-none bg-white">
              <div className="flex flex-col items-center gap-3">
                <div className="size-16 rounded-full bg-zinc-100 border-2 border-zinc-800 flex items-center justify-center text-zinc-900 shadow-xs mb-1">
                  <GraduationCap className="size-9" />
                </div>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-zinc-900 font-serif">
                  {classroom?.institutionName || "FACULTY OF ENGINEERING & TECHNOLOGY"}
                </h2>
                <h3 className="text-sm sm:text-base font-bold uppercase tracking-widest text-zinc-700 font-serif">
                  DEPARTMENT OF {classroom?.department || "COMPUTER & PHYSICAL SCIENCES"}
                </h3>
                <div className="w-32 h-0.5 bg-zinc-800 my-1" />
              </div>

              <div className="my-8 flex flex-col items-center gap-4">
                <span className="text-xs font-black uppercase tracking-[0.25em] text-zinc-500 bg-zinc-100 px-4 py-1 rounded-full border border-zinc-300">
                  OFFICIAL LABORATORY RECORD
                </span>
                <h1 className="text-2xl sm:text-4xl font-black text-zinc-950 uppercase tracking-tight font-serif">
                  {classroom?.name || "LABORATORY COURSEWORK"}
                </h1>
                <p className="text-sm font-semibold text-zinc-600 max-w-md">
                  {classroom?.subject ? `Course Subject: ${classroom.subject}` : "Comprehensive Practical Manual & Research Journal"}
                </p>
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-zinc-700 bg-zinc-50 px-3 py-1 rounded border border-zinc-300">
                  <span>Code: {classroom?.code || "LAB-101"}</span>
                  <span>•</span>
                  <span>Semester {classroom?.semester || "IV"}</span>
                  <span>•</span>
                  <span>Academic Year {new Date().getFullYear()}–{new Date().getFullYear() + 1}</span>
                </div>
              </div>

              <div className="w-full max-w-md mx-auto border-2 border-zinc-800 p-5 rounded-md text-left bg-zinc-50/50">
                <div className="text-xs font-black uppercase tracking-wider text-zinc-500 border-b border-zinc-300 pb-2 mb-3">
                  Candidate Information
                </div>
                <div className="grid grid-cols-2 gap-y-2.5 text-xs">
                  <span className="font-bold text-zinc-600">Student Name:</span>
                  <strong className="text-zinc-950 font-bold">{user?.fullName || "Student Name"}</strong>

                  <span className="font-bold text-zinc-600">Roll Number:</span>
                  <strong className="text-zinc-950 font-mono font-bold">{user?.rollNumber || "—"}</strong>

                  <span className="font-bold text-zinc-600">Enrollment No:</span>
                  <strong className="text-zinc-950 font-mono font-bold">{user?.enrollmentId || user?.id?.slice(0, 10) || "—"}</strong>

                  <span className="font-bold text-zinc-600">Lab Batch / Group:</span>
                  <strong className="text-zinc-950 font-mono font-bold">{user?.batch || "Batch A"}</strong>

                  <span className="font-bold text-zinc-600">Date of Compilation:</span>
                  <span className="text-zinc-950 font-medium">{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                </div>
              </div>

              <div className="text-[11px] text-zinc-500 uppercase tracking-widest pt-4">
                Certified by University Academic Evaluation Board
              </div>
            </section>

            {/* PAGE 2: OFFICIAL COMPLETION CERTIFICATE */}
            <section className="page-break-before page-break-after flex flex-col justify-between min-h-[960px] border-4 border-zinc-800 p-10 sm:p-14 text-center select-none bg-white">
              <div className="flex flex-col items-center gap-2 pt-4">
                <div className="size-14 rounded-full bg-zinc-100 border border-zinc-400 flex items-center justify-center text-zinc-900 mb-1">
                  <ShieldCheck className="size-8 text-zinc-800" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-widest text-zinc-900 font-serif">
                  CERTIFICATE
                </h2>
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Department of {classroom?.department || "Engineering & Applied Sciences"}
                </h3>
                <div className="w-24 h-0.5 bg-zinc-800 my-2" />
              </div>

              <div className="my-8 px-4 sm:px-8 text-justify text-sm sm:text-base leading-relaxed text-zinc-800 font-serif space-y-4">
                <p>
                  This is to certify that <strong>{user?.fullName || "the student"}</strong>, bearing 
                  Roll Number <strong>{user?.rollNumber || "—"}</strong> and Enrollment Number <strong>{user?.enrollmentId || user?.id?.slice(0, 10) || "—"}</strong>, 
                  is a bona fide student of Semester <strong>{classroom?.semester || "IV"}</strong> in the academic year <strong>{new Date().getFullYear()}–{new Date().getFullYear() + 1}</strong>.
                </p>
                <p>
                  He / She has satisfactorily completed the prescribed course of laboratory coursework and practical assignments in 
                  <strong> {classroom?.name || "Laboratory Work"} ({classroom?.code || "LAB-101"})</strong> as laid down by the Academic Council and Board of Studies.
                </p>
                <p>
                  All mathematical calculations, experimental observations, and Cartesian analytical plots recorded in this journal represent the student's authentic original laboratory work.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-16 border-t border-zinc-300 text-center text-xs">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-28 border-b border-zinc-800 mb-2" />
                  <strong className="text-zinc-900 font-bold">Staff In-Charge</strong>
                  <span className="text-[11px] text-zinc-500">Subject Faculty</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="w-28 border-b border-zinc-800 mb-2" />
                  <strong className="text-zinc-900 font-bold">External Examiner</strong>
                  <span className="text-[11px] text-zinc-500">Appointed Authority</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="w-28 border-b border-zinc-800 mb-2" />
                  <strong className="text-zinc-900 font-bold">Head of Department</strong>
                  <span className="text-[11px] text-zinc-500">Institutional Seal</span>
                </div>
              </div>
            </section>

            {/* PAGE 3: CONSOLIDATED INDEX TABLE (GRADES ONLY, STRICTLY NO REMARKS) */}
            <section className="page-break-before page-break-after flex flex-col min-h-[960px] p-6 sm:p-10 select-none bg-white">
              <div className="text-center border-b-2 border-zinc-800 pb-3 mb-6">
                <h2 className="text-2xl font-black uppercase tracking-wider text-zinc-900 font-serif">
                  INDEX OF EXPERIMENTS
                </h2>
                <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mt-1">
                  Academic Record of Practical Assignments & Evaluated Grades
                </p>
              </div>

              <div className="overflow-x-auto border border-zinc-800 rounded-md print:overflow-visible">
                <table className="min-w-full divide-y divide-zinc-800 text-xs text-zinc-900 print:w-full print:table-auto">
                  <thead className="bg-zinc-100 font-bold uppercase tracking-wider">
                    <tr className="divide-x divide-zinc-800">
                      <th className="w-12 px-2 py-3 text-center">Sr.</th>
                      <th className="px-4 py-3 text-left">Experiment Title</th>
                      <th className="w-24 px-3 py-3 text-center">Date Performed</th>
                      <th className="w-24 px-3 py-3 text-center">Date Submitted</th>
                      <th className="w-20 px-2 py-3 text-center">Page No.</th>
                      <th className="w-20 px-2 py-3 text-center">Grade</th>
                      <th className="w-24 px-3 py-3 text-center">Faculty Sign</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-300">
                    {compiledPracticals.map((item) => {
                      const marksStr =
                        item.journal?.marks !== undefined && item.journal?.marks !== null
                          ? `${item.journal.marks}/${item.assignment.maxMarks || 10}`
                          : item.journal?.status === "submitted"
                          ? "Submitted"
                          : "Draft";

                      const perfDate = item.assignment.createdAt
                        ? new Date(item.assignment.createdAt).toLocaleDateString()
                        : "—";

                      const subDate = item.journal?.submittedAt
                        ? new Date(item.journal.submittedAt).toLocaleDateString()
                        : "—";

                      return (
                        <tr key={item.index} className="divide-x divide-zinc-800 hover:bg-zinc-50 font-medium">
                          <td className="px-2 py-3 text-center font-bold font-mono">{item.index}</td>
                          <td className="px-4 py-3 text-left font-semibold text-zinc-950">
                            {item.assignment.title}
                          </td>
                          <td className="px-3 py-3 text-center font-mono text-zinc-600">{perfDate}</td>
                          <td className="px-3 py-3 text-center font-mono text-zinc-600">{subDate}</td>
                          <td className="px-2 py-3 text-center font-mono font-bold text-zinc-700">
                            {item.pageRange}
                          </td>
                          <td className="px-2 py-3 text-center font-mono font-bold text-zinc-950">
                            {marksStr}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="h-4 border-b border-dashed border-zinc-400 w-16 mx-auto" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 text-[11px] text-zinc-500 italic">
                * Note: Page numbers represent continuous pagination throughout the compiled master laboratory manual.
              </div>
            </section>
          </>
        )}

        {/* =========================================================================
            PRACTICAL EXPERIMENT RENDERING (SHARED SINGLE & ALL JOURNALS ENGINE)
            ========================================================================= */}
        {compiledPracticals.map((item) => {
          const blocks = item.journal?.blocks || [];

          return (
            <section
              key={item.index}
              className={`${!isSingleMode ? "page-break-before pt-6" : "pt-0"} pb-12 border-b border-zinc-200 last:border-b-0`}
            >
              {/* Practical Header Bar */}
              <div className="border-b-2 border-zinc-900 pb-4 mb-6">
                {/* Department Course Code Line in Single Journal Mode */}
                {isSingleMode && (
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-2 mb-3 text-xs text-zinc-600 font-serif">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="size-4 text-zinc-800" />
                      <span className="font-bold uppercase tracking-wider text-zinc-900">
                        {classroom?.institutionName || "FACULTY OF ENGINEERING & TECHNOLOGY"}
                      </span>
                      <span>•</span>
                      <span className="uppercase text-zinc-600">
                        DEPT. OF {classroom?.department || "COMPUTER & PHYSICAL SCIENCES"}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-zinc-500">
                      Code: {classroom?.code || "LAB-101"}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-zinc-600 font-mono mb-1">
                  <span>PRACTICAL EXPERIMENT #{item.index}</span>
                  {!isSingleMode && <span>Page {item.pageRange}</span>}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight font-serif">
                      {item.assignment.title}
                    </h2>
                    {item.assignment.aim && (
                      <p className="text-xs text-zinc-700 mt-1 max-w-2xl">
                        <strong className="text-zinc-900 font-bold">Aim: </strong>
                        {item.assignment.aim}
                      </p>
                    )}
                  </div>

                  {item.journal?.marks !== undefined && item.journal?.marks !== null && (
                    <div className="border-2 border-zinc-900 bg-zinc-50 px-3.5 py-1.5 rounded text-center shrink-0 self-start">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Evaluated Grade</div>
                      <div className="text-sm font-black font-mono text-zinc-950">
                        {item.journal.marks} / {item.assignment.maxMarks || 10}
                      </div>
                    </div>
                  )}
                </div>

                {/* Candidate Credentials card in Single Journal Mode */}
                {isSingleMode && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-zinc-200 text-xs text-zinc-700 bg-zinc-50/70 p-3 rounded border border-zinc-200">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-500 block">Candidate Name</span>
                      <strong className="text-zinc-950 font-bold">{user?.fullName || "Student Name"}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-500 block">Roll Number</span>
                      <strong className="text-zinc-950 font-mono font-bold">{user?.rollNumber || "—"}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-500 block">Enrollment ID</span>
                      <strong className="text-zinc-950 font-mono font-bold">{user?.enrollmentId || user?.id?.slice(0, 10) || "—"}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-500 block">Submission Date</span>
                      <span className="text-zinc-950 font-medium">
                        {item.journal?.submittedAt
                          ? new Date(item.journal.submittedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                          : new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Render all journal blocks with KaTeX, Auto-Fitted Tables & Cartesian Graphs */}
              {blocks.length === 0 ? (
                <div className="p-8 border border-dashed border-zinc-300 rounded-xl text-center text-zinc-400 text-xs font-mono">
                  No observation data recorded for this practical experiment.
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {blocks.map((block: any) => (
                    <div key={block.id} className="page-break-avoid">
                      <BlockRenderer
                        id={block.id}
                        type={block.type}
                        content={block.content}
                        previewMode={true}
                        allBlocks={blocks}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Official Faculty Verification & Signature Block (Present at the end of EVERY practical!) */}
              <div className="mt-12 pt-6 border-t-2 border-zinc-900 page-break-avoid select-none">
                <div className="flex items-center justify-between text-xs text-zinc-600">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <span className="font-semibold text-zinc-800">
                      Status: {item.journal?.status === "approved" ? "Official Evaluated Submission" : "Laboratory Practical Submission"}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-36 border-b border-zinc-800 mb-1" />
                    <strong className="text-zinc-900 font-bold">Faculty Signature & Date</strong>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
