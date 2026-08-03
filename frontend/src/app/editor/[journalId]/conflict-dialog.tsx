"use client";

import { AlertTriangle, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConflictDialogProps {
  isOpen: boolean;
  onReloadServer: () => void;
  onForceSaveLocal: () => void;
  isReloading?: boolean;
  isSaving?: boolean;
}

export default function ConflictDialog({
  isOpen,
  onReloadServer,
  onForceSaveLocal,
  isReloading = false,
  isSaving = false,
}: ConflictDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-rose-500/30 p-6 shadow-2xl flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
            <AlertTriangle className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-bold text-foreground">
              Document Revision Conflict (409)
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This document has been updated elsewhere (or in another tab). Your local unsaved edits conflict with the server version.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 font-medium">
          Choose how you would like to resolve this revision mismatch:
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReloadServer}
            disabled={isReloading || isSaving}
            className="w-full sm:w-auto gap-2 text-xs font-semibold rounded-xl"
          >
            <RefreshCw className={`size-3.5 ${isReloading ? "animate-spin" : ""}`} />
            <span>Reload Latest Server Version</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={onForceSaveLocal}
            disabled={isReloading || isSaving}
            className="w-full sm:w-auto gap-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white border-0 rounded-xl"
          >
            <Save className={`size-3.5 ${isSaving ? "animate-spin" : ""}`} />
            <span>Overwrite with Local Draft</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
