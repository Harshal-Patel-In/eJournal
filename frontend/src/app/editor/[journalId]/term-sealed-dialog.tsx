"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Lock, Printer, Download, ArrowLeft, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TermSealedDialogProps {
  isOpen: boolean;
  onClose: () => void;
  journalId: string;
  journalTitle?: string;
  classroomId?: string;
  blocks?: any[];
}

export function TermSealedDialog({
  isOpen,
  onClose,
  journalId,
  journalTitle,
  classroomId,
  blocks = [],
}: TermSealedDialogProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    try {
      const exportData = {
        journalId,
        title: journalTitle || "Untitled Journal",
        blocks,
        exportedAt: new Date().toISOString(),
        institution: "Charotar University of Science and Technology (CHARUSAT)",
        note: "Emergency uncommitted local draft snapshot saved upon academic term freeze.",
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `journal-recovery-${journalId}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to export JSON backup:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in-50 duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-card border border-border/80 shadow-2xl p-6 sm:p-7 space-y-6 relative overflow-hidden">
        {/* Institutional Glow Accent */}
        <div className="absolute -top-16 -right-16 size-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="size-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
            <Lock className="size-6" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Institutional Term Concluded
            </span>
            <h2 className="text-lg font-black tracking-tight text-foreground">
              Academic Term Officially Sealed
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your instructor or university administration has sealed this term.
              Document editing and remote sync for this course are now permanently locked for institutional archiving.
            </p>
          </div>
        </div>

        {/* Security & Data Integrity Notice */}
        <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <ShieldAlert className="size-4 text-emerald-500" />
            <span>Local State Safely Preserved</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Your most recent uncommitted changes have been automatically written to your browser&apos;s
            offline local storage (<code className="px-1 py-0.5 rounded bg-background text-foreground font-mono text-[10px]">ejournal_recovery_{journalId.slice(-6)}</code>).
            No work has been lost. You may print your master paper or download a local backup file below.
          </p>
        </div>

        {/* Actions Grid */}
        <div className="space-y-2.5">
          <Button
            onClick={handlePrint}
            className="w-full rounded-2xl text-xs font-bold gap-2 py-2.5 cursor-pointer bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
          >
            <Printer className="size-4" />
            <span>Print / Save as Master PDF</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleDownloadJson}
            className="w-full rounded-2xl text-xs font-semibold gap-2 py-2.5 cursor-pointer hover:border-amber-500/40"
          >
            <Download className="size-4 text-amber-500" />
            <span>Download Local JSON Backup</span>
          </Button>

          <div className="pt-2 flex items-center justify-between border-t border-border/60">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer rounded-xl"
            >
              Close Notice
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(classroomId ? `/classrooms/${classroomId}` : "/dashboard")}
              className="text-xs font-bold gap-1.5 cursor-pointer rounded-xl"
            >
              <ArrowLeft className="size-3.5" />
              <span>Return to Course</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

