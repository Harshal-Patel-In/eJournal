/**
 * Pre-submission Checklist and Hand-In Confirmation Modal Dialog.
 *
 * Verifies cover details, experiment aim, and provides explicit warning
 * regarding late submission cut-off and evaluation locking.
 */

"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, FileCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubmitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  journalTitle: string;
  deadline?: string;
  isLate?: boolean;
}

export function SubmitDialog({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  journalTitle,
  deadline,
  isLate = false,
}: SubmitDialogProps) {
  const [checkedCover, setCheckedCover] = useState(false);
  const [checkedAim, setCheckedAim] = useState(false);
  const [checkedLock, setCheckedLock] = useState(false);

  if (!isOpen) return null;

  const isAllChecked = checkedCover && checkedAim && checkedLock;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
      <div className="w-full max-w-md p-6 rounded-3xl glass-card flex flex-col gap-5 relative animate-in fade-in zoom-in-95 duration-200 border border-emerald-500/30">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="size-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-foreground">Hand In Practical Journal</h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Warning if late */}
        {isLate && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-start gap-2.5">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Late Submission Warning</span>
              The assignment deadline has passed. This journal will be tagged with a{" "}
              <strong className="underline">Late Submission Tag</strong> for teacher evaluation.
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            You are handing in: <strong className="text-foreground">{journalTitle}</strong>
          </p>

          {/* Checklist */}
          <div className="flex flex-col gap-2.5 mt-2 p-3.5 rounded-2xl bg-background/50 border border-border">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Pre-Submission Checklist
            </span>

            <label className="flex items-center gap-2.5 text-xs text-foreground font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={checkedCover}
                onChange={(e) => setCheckedCover(e.target.checked)}
                className="size-4 rounded border-input accent-emerald-500 cursor-pointer"
              />
              <span>Cover metadata (Name, Reg No, Batch) is accurate</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-foreground font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={checkedAim}
                onChange={(e) => setCheckedAim(e.target.checked)}
                className="size-4 rounded border-input accent-emerald-500 cursor-pointer"
              />
              <span>Experimental observations & math derivations are complete</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-foreground font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={checkedLock}
                onChange={(e) => setCheckedLock(e.target.checked)}
                className="size-4 rounded border-input accent-emerald-500 cursor-pointer"
              />
              <span>I understand direct edits lock upon submission</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!isAllChecked || isSubmitting}
            className="rounded-xl glass-btn-emerald gap-2"
          >
            <Send className="size-3.5" />
            <span>{isSubmitting ? "Handing In..." : "Hand In Now"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
