"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2, X, Loader2, Lock, ShieldAlert, CloudOff } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

interface DeepPurgeClassroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroom: {
    id: string;
    name: string;
    subjectCode?: string;
    studentCount?: number;
    assignmentCount?: number;
  } | null;
  onSuccess?: () => void;
}

export function DeepPurgeClassroomModal({
  isOpen,
  onClose,
  classroom,
  onSuccess,
}: DeepPurgeClassroomModalProps) {
  const queryClient = useQueryClient();
  const [typedTitle, setTypedTitle] = useState("");
  const [password, setPassword] = useState("");

  const purgeMutation = useMutation({
    mutationFn: (payload: { classroomId: string; confirmTitle: string; password: string }) =>
      api.post<any>(`/admin/classrooms/${payload.classroomId}/purge`, {
        confirmTitle: payload.confirmTitle,
        password: payload.password,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-classrooms"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success(
        data.message || `Purged ${data.journalsPurged || 0} journals & ${data.imagesPurged || 0} Cloudinary assets.`,
        { title: "💥 Deep Storage Purged" }
      );
      handleClose();
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to purge classroom.");
    },
  });

  const handleClose = () => {
    setTypedTitle("");
    setPassword("");
    onClose();
  };

  if (!isOpen || !classroom) return null;

  const isTitleMatch = typedTitle.trim() === classroom.name.trim();
  const canSubmit = isTitleMatch && password.length >= 1 && !purgeMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    purgeMutation.mutate({
      classroomId: classroom.id,
      confirmTitle: typedTitle.trim(),
      password,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in-50 duration-150">
      <div className="w-full max-w-lg rounded-3xl bg-card border border-destructive/40 shadow-2xl p-6 sm:p-7 space-y-6 relative overflow-hidden">
        {/* Ambient Danger Glow */}
        <div className="absolute -top-20 -right-20 size-48 bg-destructive/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-destructive/15 text-destructive border border-destructive/30 flex items-center justify-center font-bold shrink-0">
              <Trash2 className="size-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-destructive">
                Irreversible Permanent Purge
              </span>
              <h3 className="text-base font-black text-foreground">
                Deep Storage Purge & Asset Cleanup
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Severity Warning Alert */}
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/25 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            <span>Destructive Institutional Purge</span>
          </div>
          <p className="text-muted-foreground leading-relaxed text-[11px]">
            This operation will <strong>permanently purge</strong> classroom{" "}
            <span className="text-foreground font-bold">&quot;{classroom.name}&quot;</span> ({classroom.subjectCode || "LAB"}),
            including:
          </p>
          <ul className="list-disc list-inside space-y-1 text-foreground/90 font-medium pl-1 text-[11px]">
            <li>All enrolled student memberships</li>
            <li>All lab assignments ({classroom.assignmentCount ?? 0} assignments)</li>
            <li>All student submitted journals &amp; version snapshots</li>
            <li className="text-destructive font-semibold flex items-center gap-1 mt-1">
              <CloudOff className="size-3.5 inline" />
              Direct Cloudinary API batch deletion of all diagram/screenshot image assets
            </li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Confirm Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              1. Type <span className="font-mono font-bold text-destructive underline">{classroom.name}</span> to confirm:
            </label>
            <input
              type="text"
              value={typedTitle}
              onChange={(e) => setTypedTitle(e.target.value)}
              placeholder={classroom.name}
              className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-destructive focus:outline-none font-medium"
            />
          </div>

          {/* Step 2: Admin Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Lock className="size-3.5 text-muted-foreground" />
              2. Confirm with your Administrator Password:
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your current password"
              className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-destructive focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={purgeMutation.isPending}
              className="rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={!canSubmit}
              className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer shadow-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {purgeMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Purging Cloud Assets &amp; Database...
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  Permanently Purge Classroom
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

