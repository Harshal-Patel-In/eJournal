/**
 * Interactive Version History Drawer component.
 *
 * Provides timeline of document snapshots, revision diffs, and restore capabilities.
 */

"use client";

import { History, GitCommit, RotateCcw, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface VersionRecord {
  id: string;
  revisionNumber: number;
  authorId: string;
  authorRole: string;
  status: string;
  trigger?: string;
  remarks?: string;
  createdAt: string;
}

interface VersionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  versions: VersionRecord[];
  currentVersion: number;
  onRestoreVersion: (revisionNumber: number) => void;
  isRestoring?: boolean;
  userRole?: string;
  journalStatus?: string;
}

export function VersionHistoryDrawer({
  isOpen,
  onClose,
  versions,
  currentVersion,
  onRestoreVersion,
  isRestoring = false,
  userRole,
  journalStatus = "draft",
}: VersionHistoryDrawerProps) {
  if (!isOpen) return null;

  const isTeacher = userRole === "teacher";
  const isLockedState = ["submitted", "late_submitted", "approved"].includes(journalStatus);
  const canRestore = !isTeacher && !isLockedState;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm h-full glass-card border-l border-border/80 p-5 flex flex-col gap-4 overflow-y-auto shadow-2xl relative">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">Version History & Revisions</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/80 transition-all cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {isTeacher
            ? "Inspect historical revision snapshots of student journal submissions. Restoring is restricted for reviewers."
            : isLockedState
            ? "Immutable historical snapshot timeline. Document is locked upon submission or approval."
            : "Immutable snapshot history stored per document auto-save, hand-in submission, or restore."}
        </p>

        {/* Revision Timeline */}
        <div className="flex flex-col gap-3 mt-2">
          {versions.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No previous version snapshots available.
            </div>
          ) : (
            versions.map((ver) => {
              const isCurrent = ver.revisionNumber === currentVersion;
              return (
                <div
                  key={ver.id || ver.revisionNumber}
                  className={`p-3.5 rounded-2xl glass-card border flex flex-col gap-2 relative transition-all ${
                    isCurrent
                      ? "border-primary/40 bg-primary/5 shadow-xs"
                      : "border-border/60 hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitCommit className={`size-4 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-xs font-bold text-foreground">
                        Revision #{ver.revisionNumber}
                      </span>
                    </div>
                    {isCurrent ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-primary/20 text-primary border border-primary/30">
                        Active Server Revision
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground/80 uppercase">
                        Snapshot
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {new Date(ver.createdAt).toLocaleDateString()} {new Date(ver.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="capitalize font-semibold text-foreground/80">
                      {ver.trigger || ver.status}
                    </span>
                  </div>

                  {ver.remarks && (
                    <p className="text-[11px] text-muted-foreground/90 bg-muted/30 p-2 rounded-xl border border-border/40 font-mono leading-tight">
                      {ver.remarks}
                    </p>
                  )}

                  {!isCurrent && (
                    canRestore ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRestoreVersion(ver.revisionNumber)}
                        disabled={isRestoring}
                        className="mt-1 h-7 text-[11px] font-semibold rounded-xl gap-1.5 self-end hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                      >
                        <RotateCcw className="size-3" />
                        <span>{isRestoring ? "Restoring..." : `Restore to Rev #${ver.revisionNumber}`}</span>
                      </Button>
                    ) : (
                      <span className="mt-1 text-[10px] font-bold text-muted-foreground/60 italic self-end">
                        {isTeacher ? "Inspection Only" : "Locked Upon Submission"}
                      </span>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
