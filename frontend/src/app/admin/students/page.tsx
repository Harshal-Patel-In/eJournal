"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GraduationCap,
  Search,
  KeyRound,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Clock,
} from "lucide-react";

import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { CHARUSAT_DEPARTMENTS } from "@/lib/academic-constants";

const DEPARTMENT_OPTIONS = [
  { value: "", label: "All Academic Departments" },
  ...CHARUSAT_DEPARTMENTS,
];

const STATUS_OPTIONS = [
  { value: "", label: "All Account Statuses" },
  { value: "active", label: "Active" },
  { value: "pending_setup", label: "Setup Pending (Incomplete Profile)" },
  { value: "unverified", label: "Unverified (Pending OTP)" },
  { value: "suspended", label: "Suspended" },
];

export default function AdminStudentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showResetModal, setShowResetModal] = useState<any>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Fetch students
  const { data, isLoading, refetch, isRefetching } = useQuery<any>({
    queryKey: ["admin-students", search, department, statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({
        role: "student",
        page: page.toString(),
        limit: "15",
      });
      if (search) params.set("search", search);
      if (department) params.set("department", department);
      if (statusFilter) params.set("status", statusFilter);
      return api.get(`/admin/users?${params.toString()}`);
    },
  });

  // Toggle Status Mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      api.patch<any>(`/admin/users/${id}/status`, { status: newStatus }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.info(`Student account status set to '${vars.newStatus}'.`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update student status");
    },
  });

  // Delete User Mutation (Cascade purge MongoDB + Cloudinary)
  const deleteMutation = useMutation({
    mutationFn: (userId: string) => api.delete<any>(`/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Student and all associated records permanently purged.", { title: "User Deleted" });
      setDeleteConfirmUser(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete student");
    },
  });

  // Reset Password Mutation
  const resetMutation = useMutation({
    mutationFn: (userId: string) => api.post<any>(`/admin/users/${userId}/reset-password`, {}),
    onSuccess: (res) => {
      setShowResetModal(res);
      toast.success("Student password reset successfully. Notification sent via email.", { title: "Temporary Key Issued" });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reset password");
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    toast.success("Temporary password copied to clipboard!");
  };


  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">University Student Directory</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Supervise enrolled students, inspect academic profiles, and manage disciplinary status
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="rounded-xl text-xs font-semibold gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          <span>Refresh Directory</span>
        </Button>
      </div>

      {/* Search, Department & Status Filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by student name, email, or enrollment / roll number..."
            className="w-full pl-10 pr-4 py-2 rounded-2xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <CustomSelect
            value={department}
            onChange={(val) => {
              setDepartment(val);
              setPage(1);
            }}
            options={DEPARTMENT_OPTIONS}
            placeholder="All Academic Departments"
            className="w-full sm:w-60 shrink-0"
          />

          <CustomSelect
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
            placeholder="All Account Statuses"
            className="w-full sm:w-56 shrink-0"
          />
        </div>
      </div>

      {/* Students Table */}
      <div className="rounded-3xl bg-card border border-border/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="py-3 px-5">Student Details</th>
                <th className="py-3 px-4">Enrollment / Roll No</th>
                <th className="py-3 px-4">Department & Class</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="size-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading student directory...
                  </td>
                </tr>
              ) : !data?.users || data.users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    No students found matching your search.
                  </td>
                </tr>
              ) : (
                data.users.map((s: any) => {
                  const isSuspended = s.status === "suspended";
                  const isUnverified = s.is_verified === false;
                  const profile = s.profile || {};
                  const isPendingSetup = !isUnverified && (!profile.enrollmentNumber || s.is_profile_complete === false);
                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-muted/20 transition-colors ${
                        isPendingSetup ? "bg-amber-500/[0.03] dark:bg-amber-500/[0.04]" : ""
                      }`}
                    >
                      <td className="py-3.5 px-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground text-xs">{profile.name || "Enrolled Student"}</span>
                          <span className="text-[11px] text-muted-foreground font-mono">{s.email}</span>
                          {isUnverified && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                              Unverified registration (No OTP submitted)
                            </span>
                          )}
                          {isPendingSetup && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                              <AlertCircle className="size-3 shrink-0" />
                              Academic onboarding incomplete
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-foreground">
                        {isUnverified ? (
                          <span className="text-muted-foreground font-normal">—</span>
                        ) : isPendingSetup ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                            <AlertCircle className="size-3 shrink-0" />
                            Pending Setup
                          </span>
                        ) : (
                          profile.enrollmentNumber || profile.rollNumber || "—"
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground text-xs">{profile.department || "General"}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {profile.semester ? `Sem ${profile.semester}` : ""}
                            {profile.division ? ` • Div ${profile.division}` : ""}
                            {profile.batch ? ` • Batch ${profile.batch}` : ""}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {isUnverified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25">
                            <Clock className="size-3" />
                            Pending Verification
                          </span>
                        ) : isSuspended ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20">
                            Suspended
                          </span>
                        ) : isPendingSetup ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                            <Clock className="size-3" />
                            Setup Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isUnverified && (
                            <Button
                              variant="outline"
                              color={isSuspended ? "emerald" : "amber"}
                              size="sm"
                              onClick={() =>
                                statusMutation.mutate({
                                  id: s.id,
                                  newStatus: isSuspended ? "active" : "suspended",
                                })
                              }
                              disabled={statusMutation.isPending}
                              className="h-7 px-2.5 rounded-xl text-[11px] font-semibold cursor-pointer"
                            >
                              <span>{isSuspended ? "Reactivate" : "Suspend"}</span>
                            </Button>
                          )}

                          {!isUnverified && (
                            <Button
                              variant="outline"
                              color="neutral"
                              size="sm"
                              onClick={() => resetMutation.mutate(s.id)}
                              disabled={resetMutation.isPending}
                              className="h-7 px-2.5 rounded-xl text-[11px] font-semibold cursor-pointer"
                              title="Reset Password"
                            >
                              <KeyRound className="size-3 mr-1" />
                              <span>Reset</span>
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            color="rose"
                            size="sm"
                            onClick={() => setDeleteConfirmUser(s)}
                            disabled={deleteMutation.isPending}
                            className="h-7 px-2.5 rounded-xl text-[11px] font-semibold cursor-pointer"
                            title="Permanently Delete Student"
                          >
                            <Trash2 className="size-3 mr-1" />
                            <span>Delete</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        {data && data.total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-border/80 bg-muted/20 text-xs">
            <span className="text-muted-foreground">
              Showing page <strong className="text-foreground">{data.page || page}</strong> of{" "}
              <strong className="text-foreground">{data.totalPages || 1}</strong>{" "}
              <span className="text-muted-foreground/80">({data.total} registered {data.total === 1 ? "student" : "students"})</span>
            </span>

            {data.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                  className="h-7 px-3 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page >= data.totalPages || isLoading}
                  className="h-7 px-3 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Temporary Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-50 duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-card border border-border p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <KeyRound className="size-4 text-amber-500" />
              Temporary Student Password
            </h3>
            <p className="text-xs text-muted-foreground">
              A temporary password has been issued and dispatched via email to the student:
            </p>
            <div className="flex items-center justify-between bg-muted/40 p-3 rounded-xl border border-border">
              <code className="text-xs font-mono font-bold text-foreground">{showResetModal.temporaryPassword}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(showResetModal.temporaryPassword)}
                className="rounded-xl text-xs gap-1.5 h-7 cursor-pointer"
              >
                {copiedKey ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                <span>{copiedKey ? "Copied" : "Copy"}</span>
              </Button>
            </div>
            <Button
              onClick={() => setShowResetModal(null)}
              className="w-full rounded-xl text-xs font-bold cursor-pointer"
            >
              Done
            </Button>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-50 duration-150">
          <div className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Confirm Permanent Deletion</h3>
                <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-xs text-foreground space-y-1.5">
              <p>
                Are you sure you want to permanently delete student{" "}
                <strong className="font-mono text-rose-600 dark:text-rose-400">
                  {deleteConfirmUser.email}
                </strong>
                ?
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                This will purge their user record, remove classroom enrollments, delete all journal documents and blocks, and destroy any uploaded images on Cloudinary storage.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmUser(null)}
                disabled={deleteMutation.isPending}
                className="rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate(deleteConfirmUser.id)}
                disabled={deleteMutation.isPending}
                className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
              >
                {deleteMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                <span>{deleteMutation.isPending ? "Purging Data..." : "Delete Permanently"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

