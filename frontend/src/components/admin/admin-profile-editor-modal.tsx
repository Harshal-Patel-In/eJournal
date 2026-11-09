"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IdCard,
  Building2,
  BookOpen,
  Check,
  X,
  Loader2,
  Clock,
  ArrowRight,
  AlertCircle,
  FileText,
  Save,
  RotateCcw,
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
import { formatRelativeTimeIST } from "@/lib/date";

interface AdminProfileEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  pendingRequest?: any;
  onSuccess?: () => void;
}

export function AdminProfileEditorModal({
  isOpen,
  onClose,
  student,
  pendingRequest,
  onSuccess,
}: AdminProfileEditorModalProps) {
  const queryClient = useQueryClient();

  // Fetch full student document by ID to guarantee fresh, complete details
  const { data: freshUserData } = useQuery<any>({
    queryKey: ["admin-user-details", student?.id],
    queryFn: () => api.get(`/admin/users/${student.id}`),
    enabled: isOpen && !!student?.id,
    staleTime: 0,
  });

  const activeUser = freshUserData || student;

  const [name, setName] = useState("");
  const [enrollmentNumber, setEnrollmentNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [college, setCollege] = useState("");
  const [semester, setSemester] = useState("");
  const [division, setDivision] = useState("");
  const [batch, setBatch] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  // Rejection drawer state
  const [showRejectDrawer, setShowRejectDrawer] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Populate form with complete user profile and pre-apply pending requested change
  useEffect(() => {
    if (activeUser) {
      const p = activeUser.profile || {};
      const initialName = p.name || activeUser.name || "";
      let initialEnr = p.enrollmentNumber || p.rollNumber || "";
      let initialDept = p.department || "";
      let initialCollege = p.college || "";
      const initialSem = p.semester ? String(p.semester) : "";
      const initialDiv = p.division || "";
      const initialBatch = p.batch || "";

      // If pending request exists, pre-apply requested modification into initial form state
      if (pendingRequest) {
        if (pendingRequest.field === "enrollmentNumber") {
          initialEnr = pendingRequest.requestedValue;
        } else if (pendingRequest.field === "name") {
          // name correction
        } else if (pendingRequest.field === "department") {
          initialDept = pendingRequest.requestedValue;
        } else if (pendingRequest.field === "college") {
          initialCollege = pendingRequest.requestedValue;
        }
      }

      setName(initialName);
      setEnrollmentNumber(initialEnr);
      setDepartment(initialDept);
      setCollege(initialCollege);
      setSemester(initialSem);
      setDivision(initialDiv);
      setBatch(initialBatch);
      setAdminNotes("");
      setShowRejectDrawer(false);
      setRejectionReason("");
    }
  }, [activeUser, pendingRequest, isOpen]);

  // Direct Update Mutation
  const directUpdateMutation = useMutation({
    mutationFn: (payload: any) =>
      api.patch(`/admin/users/${activeUser.id}/profile`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pending-profile-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-details"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["active-profile-change-request"] });
      toast.success("Academic profile record updated successfully.");
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update profile record");
    },
  });

  // Approve Change Request Mutation
  const approveMutation = useMutation({
    mutationFn: (payload: any) =>
      api.patch(`/admin/profile-requests/${pendingRequest.id}/approve`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pending-profile-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-details"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["active-profile-change-request"] });
      toast.success("Correction request approved and student credentials synchronized.");
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve correction request");
    },
  });

  // Reject Change Request Mutation
  const rejectMutation = useMutation({
    mutationFn: (payload: { rejectionReason: string }) =>
      api.patch(`/admin/profile-requests/${pendingRequest.id}/reject`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pending-profile-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-details"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["active-profile-change-request"] });
      toast.info("Correction request rejected. Notice dispatched to student.");
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reject correction request");
    },
  });

  if (!isOpen || !activeUser) return null;

  const handleDirectSave = () => {
    directUpdateMutation.mutate({
      name: name.trim() || undefined,
      enrollmentNumber: enrollmentNumber.trim() ? enrollmentNumber.trim().toUpperCase() : undefined,
      department: department.trim() || undefined,
      college: college.trim() || undefined,
      semester: semester.trim() || undefined,
      division: division.trim() || undefined,
      batch: batch.trim() || undefined,
      adminNotes: adminNotes.trim() || undefined,
    });
  };

  const handleApproveWithEdits = () => {
    if (!pendingRequest) return;
    const finalCollege =
      college.trim() || (pendingRequest.field === "college" ? pendingRequest.requestedValue : undefined);
    const finalDept =
      department.trim() || (pendingRequest.field === "department" ? pendingRequest.requestedValue : undefined);
    const finalEnr = enrollmentNumber.trim()
      ? enrollmentNumber.trim().toUpperCase()
      : pendingRequest.field === "enrollmentNumber"
      ? pendingRequest.requestedValue.toUpperCase()
      : undefined;
    const finalName =
      name.trim() || (pendingRequest.field === "name" ? pendingRequest.requestedValue : undefined);

    approveMutation.mutate({
      name: finalName,
      enrollmentNumber: finalEnr,
      department: finalDept,
      college: finalCollege,
      semester: semester.trim() || undefined,
      division: division.trim() || undefined,
      batch: batch.trim() || undefined,
      adminNotes: adminNotes.trim() || undefined,
    });
  };

  const handleRejectConfirm = () => {
    if (!rejectionReason.trim() || rejectionReason.trim().length < 5) {
      toast.error("Please provide a rejection reason of at least 5 characters.");
      return;
    }
    rejectMutation.mutate({ rejectionReason: rejectionReason.trim() });
  };

  const isSaving =
    directUpdateMutation.isPending || approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <IdCard className="size-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground tracking-tight font-serif">
                Edit Academic Profile
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeUser.profile?.name || activeUser.name || "Student"} • {activeUser.email || "No email"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* PENDING CORRECTION REQUEST BANNER (If present) */}
          {pendingRequest && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <Clock className="size-3" />
                  <span>Pending Correction Request</span>
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">
                  Submitted {formatRelativeTimeIST(pendingRequest.createdAt)}
                  {pendingRequest.bumpCount > 0 && ` • Reminders: ${pendingRequest.bumpCount}`}
                </span>
              </div>

              {/* Diff Comparison */}
              <div className="p-3 rounded-lg border border-border/80 bg-card text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                    Requested Field Modification: {pendingRequest.field}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap font-mono font-bold text-xs">
                    <span className="line-through text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                      {pendingRequest.currentValue || "(Empty)"}
                    </span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded">
                      {pendingRequest.requestedValue}
                    </span>
                  </div>
                </div>

                {/* Reset or Re-apply helper */}
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (pendingRequest.field === "enrollmentNumber") {
                        setEnrollmentNumber(pendingRequest.requestedValue);
                      } else if (pendingRequest.field === "name") {
                        setName(pendingRequest.requestedValue);
                      } else if (pendingRequest.field === "department") {
                        setDepartment(pendingRequest.requestedValue);
                      } else if (pendingRequest.field === "college") {
                        setCollege(pendingRequest.requestedValue);
                      }
                      toast.info(`Applied '${pendingRequest.requestedValue}' to form below.`);
                    }}
                    className="rounded-lg h-7 px-2.5 text-xs font-semibold cursor-pointer"
                  >
                    Apply Requested Value
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (pendingRequest.field === "enrollmentNumber") {
                        setEnrollmentNumber(pendingRequest.currentValue || "");
                      } else if (pendingRequest.field === "name") {
                        setName(pendingRequest.currentValue || "");
                      } else if (pendingRequest.field === "department") {
                        setDepartment(pendingRequest.currentValue || "");
                      } else if (pendingRequest.field === "college") {
                        setCollege(pendingRequest.currentValue || "");
                      }
                      toast.info("Reverted to original database value.");
                    }}
                    className="rounded-lg h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Revert to original value before student requested change"
                  >
                    <RotateCcw className="size-3" />
                  </Button>
                </div>
              </div>

              {/* Student Justification */}
              <div className="text-xs text-muted-foreground bg-card/60 rounded-lg p-2.5 border border-border/60">
                <span className="font-semibold text-foreground mr-1">Student Note:</span>
                <span>{pendingRequest.reason}</span>
              </div>

              {/* Rejection Drawer Form */}
              {showRejectDrawer && (
                <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/5 space-y-2 mt-2">
                  <label className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="size-3.5" />
                    <span>Administrative Rejection Reason (Mandatory)</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain to the student why this correction cannot be approved (e.g. Identity card mismatch, invalid department code)..."
                    rows={2}
                    className="w-full p-2.5 text-xs rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none font-medium"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRejectDrawer(false)}
                      disabled={isSaving}
                      className="rounded-lg h-7 px-2.5 text-xs font-medium cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      color="rose"
                      size="sm"
                      onClick={handleRejectConfirm}
                      disabled={isSaving || rejectionReason.trim().length < 5}
                      className="rounded-lg h-7 px-3 text-xs font-semibold gap-1.5 cursor-pointer bg-rose-600 text-white hover:bg-rose-700 border-rose-600"
                    >
                      {rejectMutation.isPending ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <X className="size-3" />
                      )}
                      <span>Confirm Rejection</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EDITABLE PROFILE FIELDS */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/60 pb-2">
              <IdCard className="size-3.5 text-primary" />
              <span>Identity & Enrollment</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-foreground">Full Legal Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Harshal Patel"
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-foreground flex items-center justify-between">
                  <span>Enrollment / Roll Number</span>
                  {pendingRequest?.field === "enrollmentNumber" && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase">
                      Requested field
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={enrollmentNumber}
                  onChange={(e) => setEnrollmentNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. 24CS065"
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-foreground text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/60 pb-2 pt-2">
              <Building2 className="size-3.5 text-primary" />
              <span>Institutional Affiliation & Cohort</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="font-medium text-foreground flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="size-3 text-muted-foreground" />
                    <span>Constituent College / Institute</span>
                  </div>
                  {pendingRequest?.field === "college" && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase">
                      Requested change applied
                    </span>
                  )}
                </label>
                <CustomSelect
                  value={college}
                  onChange={setCollege}
                  options={CHARUSAT_COLLEGES}
                  placeholder="Select constituent college..."
                  className="w-full"
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="font-medium text-foreground flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="size-3 text-muted-foreground" />
                    <span>Academic Department / Discipline</span>
                  </div>
                  {pendingRequest?.field === "department" && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase">
                      Requested change applied
                    </span>
                  )}
                </label>
                <CustomSelect
                  value={department}
                  onChange={setDepartment}
                  options={CHARUSAT_DEPARTMENTS}
                  placeholder="Select academic department..."
                  className="w-full"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-foreground">Current Semester</label>
                <CustomSelect
                  value={semester}
                  onChange={setSemester}
                  options={SEMESTER_OPTIONS}
                  placeholder="Select semester..."
                  className="w-full"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-foreground">Class Division</label>
                <input
                  type="text"
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  placeholder="e.g. 1, Div A"
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="font-medium text-foreground">Practical Batch</label>
                <input
                  type="text"
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  placeholder="e.g. Batch A1"
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="font-medium text-foreground flex items-center gap-1.5">
                  <FileText className="size-3 text-muted-foreground" />
                  <span>Administrative Audit Note (Optional)</span>
                </label>
                <input
                  type="text"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="e.g. Corrected institutional records per verified identity credentials"
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer - Unified Actions */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg text-xs font-medium cursor-pointer"
            >
              Cancel
            </Button>

            {pendingRequest && (
              <Button
                type="button"
                variant="outline"
                color="rose"
                size="sm"
                onClick={() => setShowRejectDrawer((prev) => !prev)}
                disabled={isSaving}
                className="rounded-lg text-xs font-semibold gap-1.5 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
              >
                <X className="size-3.5" />
                <span>{showRejectDrawer ? "Hide Reject Form" : "Reject Request..."}</span>
              </Button>
            )}
          </div>

          {pendingRequest ? (
            <Button
              type="button"
              size="sm"
              onClick={handleApproveWithEdits}
              disabled={isSaving}
              className="rounded-lg text-xs font-semibold gap-1.5 cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] shadow-xs"
            >
              {approveMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              <span>Approve & Synchronize Record</span>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleDirectSave}
              disabled={isSaving}
              className="rounded-lg text-xs font-semibold gap-1.5 cursor-pointer active:scale-[0.98]"
            >
              {directUpdateMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              <span>Save Profile Changes</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
