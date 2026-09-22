"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Search,
  Plus,
  Copy,
  Check,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  X,
  Filter,
  RefreshCw,
  Crown,
  Trash2,
  AlertTriangle,
} from "lucide-react";

import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

export default function AdminFacultyPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [page, setPage] = useState(1);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState<any>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Form states for creating faculty
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [deptInput, setDeptInput] = useState("Computer Science & Engineering");
  const [designation, setDesignation] = useState("Assistant Professor");
  const [password, setPassword] = useState("");
  const [createdResult, setCreatedResult] = useState<any>(null);

  // Current admin session user
  const { data: currentUser } = useQuery<any>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile"),
    retry: false,
  });

  const isSuperAdmin = currentUser?.role === "admin";

  // Query faculty list
  const { data, isLoading, refetch, isRefetching } = useQuery<any>({
    queryKey: ["admin-faculty", search, department, page],
    queryFn: () => {
      const params = new URLSearchParams({
        role: "teacher",
        page: page.toString(),
        limit: "15",
      });
      if (search) params.set("search", search);
      if (department) params.set("department", department);
      return api.get(`/admin/users?${params.toString()}`);
    },
  });

  // Provision Faculty Mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post<any>("/admin/faculty", payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-faculty"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      setCreatedResult(res);
      toast.success("Faculty member provisioned and welcome email dispatched!", { title: "Onboarding Complete" });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to provision faculty member");
    },
  });

  // Toggle Status Mutation (Active / Suspended)
  const statusMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      api.patch<any>(`/admin/users/${id}/status`, { status: newStatus }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-faculty"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.info(`Faculty account is now ${vars.newStatus}.`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update status");
    },
  });

  // Toggle Admin Authority (Grant / Revoke Admin Role)
  const adminRoleMutation = useMutation({
    mutationFn: ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) =>
      api.patch<any>(`/admin/faculty/${userId}/admin-role`, { isAdmin }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-faculty"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success(
        vars.isAdmin
          ? "Administrative authority granted. Faculty member can now access Admin Command Center."
          : "Administrative authority revoked.",
        { title: "Authority Updated" }
      );
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update admin role");
    },
  });

  // Cascading Permanent Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (userId: string) => api.delete<any>(`/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-faculty"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Faculty member and all associated records permanently purged.", { title: "User Deleted" });
      setDeleteConfirmUser(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete faculty member");
    },
  });

  // Emergency Password Reset Mutation
  const resetMutation = useMutation({
    mutationFn: (userId: string) => api.post<any>(`/admin/users/${userId}/reset-password`, {}),
    onSuccess: (res) => {
      setShowResetModal(res);
      toast.success("Password reset successfully. A temporary key was issued and notification sent.", { title: "Credentials Reset" });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reset password");
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      email,
      department: deptInput,
      designation,
      password: password || undefined,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    toast.success("Temporary password copied to clipboard!");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Faculty Member Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Onboard professors, manage departmental appointments, and control institutional access
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setCreatedResult(null);
              setName("");
              setEmail("");
              setPassword("");
              setShowCreateModal(true);
            }}
            className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="size-3.5" />
            <span>Provision New Faculty</span>
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search faculty by name, institutional email, or ID..."
            className="w-full pl-10 pr-4 py-2 rounded-2xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
          />
        </div>

        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="rounded-2xl bg-card border border-border px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
        >
          <option value="">All Academic Departments</option>
          <option value="Computer Science">Computer Science & Engineering</option>
          <option value="Information Technology">Information Technology</option>
          <option value="Electrical">Electrical & Electronics</option>
          <option value="Mechanical">Mechanical Engineering</option>
          <option value="Civil">Civil Engineering</option>
        </select>
      </div>

      {/* Faculty Directory Table */}
      <div className="rounded-3xl bg-card border border-border/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="py-3 px-5">Faculty Member</th>
                <th className="py-3 px-4">Department & Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Onboarded</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="size-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading faculty registry...
                  </td>
                </tr>
              ) : !data?.users || data.users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    No faculty members found matching your search.
                  </td>
                </tr>
              ) : (
                data.users.map((f: any) => {
                  const isSuspended = f.status === "suspended";
                  const isTargetAdmin = Boolean(f.isAdmin || f.is_admin || f.role === "admin");
                  const isSelf = Boolean(
                    currentUser && (
                      (currentUser.id && f.id === currentUser.id) ||
                      (currentUser._id && f.id === currentUser._id) ||
                      (currentUser.email && f.email === currentUser.email)
                    )
                  );
                  return (
                    <tr key={f.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-foreground text-xs">{f.profile?.name || "Faculty Member"}</span>
                            {isSelf && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground font-mono">{f.email}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground text-xs">{f.profile?.department || "General"}</span>
                          <span className="text-[10px] text-muted-foreground">{f.profile?.designation || "Instructor"}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                              isSuspended
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            }`}
                          >
                            {isSuspended ? "Suspended" : "Active"}
                          </span>
                          {isTargetAdmin && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                              <Crown className="size-2.5" />
                              Admin Access
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                        {f.createdAt ? new Date(f.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3.5 px-5 text-right space-x-1.5 whitespace-nowrap">
                        {isSelf ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-semibold text-muted-foreground/80 bg-muted/30 border border-border/40 select-none">
                            Active Session
                          </span>
                        ) : (
                          <>
                            {/* Grant / Revoke Admin Authority (Super Admin ONLY) */}
                            {isSuperAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  adminRoleMutation.mutate({
                                    userId: f.id,
                                    isAdmin: !isTargetAdmin,
                                  })
                                }
                                disabled={adminRoleMutation.isPending}
                                className={`rounded-xl text-[11px] font-semibold h-7 cursor-pointer ${
                                  isTargetAdmin
                                    ? "border-amber-500/30 text-amber-600 bg-amber-500/5 hover:bg-amber-500/15"
                                    : "text-muted-foreground hover:text-amber-600 hover:border-amber-500/30"
                                }`}
                                title={isTargetAdmin ? "Revoke Administrative Authority" : "Grant Administrative Authority"}
                              >
                                <Crown className={`size-3 mr-1 ${isTargetAdmin ? "text-amber-500 fill-amber-500/20" : ""}`} />
                                {isTargetAdmin ? "Revoke Admin" : "Make Admin"}
                              </Button>
                            )}

                            {/* Peer Administrator Protection: Non-super-admins cannot alter peer admins */}
                            {!isSuperAdmin && isTargetAdmin ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 select-none">
                                <ShieldAlert className="size-3" />
                                Protected Admin
                              </span>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    statusMutation.mutate({
                                      id: f.id,
                                      newStatus: isSuspended ? "active" : "suspended",
                                    })
                                  }
                                  disabled={statusMutation.isPending}
                                  className={`rounded-xl text-[11px] font-semibold h-7 cursor-pointer ${
                                    isSuspended ? "text-emerald-600 border-emerald-500/30" : "text-amber-600 border-amber-500/30"
                                  }`}
                                >
                                  {isSuspended ? "Reactivate" : "Suspend"}
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => resetMutation.mutate(f.id)}
                                  disabled={resetMutation.isPending}
                                  className="rounded-xl text-[11px] font-semibold h-7 text-primary hover:bg-primary/10 cursor-pointer"
                                  title="Reset Password"
                                >
                                  <KeyRound className="size-3 mr-1" />
                                  Reset
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteConfirmUser(f)}
                                  disabled={deleteMutation.isPending}
                                  className="rounded-xl text-[11px] font-semibold h-7 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 cursor-pointer"
                                  title="Delete Faculty Account"
                                >
                                  <Trash2 className="size-3 mr-1" />
                                  Delete
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision Faculty Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-50 duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-card border border-border/80 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Users className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Provision Faculty Instructor</h3>
                  <p className="text-[11px] text-muted-foreground">Onboard new academic professor or lab instructor</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {createdResult ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 space-y-2">
                  <p className="text-xs font-bold flex items-center gap-1.5">
                    <Check className="size-4" /> Account Provisioned Successfully!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    A welcome email was dispatched to <strong>{createdResult.email}</strong>. Below is their temporary password:
                  </p>
                  <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border mt-2">
                    <code className="text-xs font-mono font-bold text-foreground">{createdResult.initialPassword}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(createdResult.initialPassword)}
                      className="rounded-xl text-xs gap-1.5 h-7 cursor-pointer"
                    >
                      {copiedKey ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                      <span>{copiedKey ? "Copied" : "Copy"}</span>
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={() => setShowCreateModal(false)}
                  className="w-full rounded-xl text-xs font-bold cursor-pointer"
                >
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Full Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Dr. Ramesh Sharma"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Institutional Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="prof.sharma@university.edu"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Department</label>
                    <input
                      type="text"
                      required
                      value={deptInput}
                      onChange={(e) => setDeptInput(e.target.value)}
                      placeholder="Computer Science & Engineering"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Designation</label>
                    <select
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value="Assistant Professor">Assistant Professor</option>
                      <option value="Associate Professor">Associate Professor</option>
                      <option value="Professor">Professor</option>
                      <option value="Head of Department">Head of Department</option>
                      <option value="Lab Instructor">Lab Instructor</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Initial Password (Optional)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave empty to auto-generate a secure temporary key"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                  <p className="text-[10px] text-muted-foreground">The faculty member will be forced to change this password upon first login.</p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={createMutation.isPending}
                    className="rounded-xl text-xs font-bold cursor-pointer"
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin mr-1.5" />
                        Provisioning...
                      </>
                    ) : (
                      "Provision & Send Email"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Emergency Password Reset Result Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-50 duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-card border border-border p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <KeyRound className="size-4 text-amber-500" />
              Temporary Password Issued
            </h3>
            <p className="text-xs text-muted-foreground">
              Please share this temporary credential with the faculty member. They will be forced to update it upon logging in:
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

      {/* Delete Faculty Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-50 duration-150">
          <div className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Confirm Faculty Account Deletion</h3>
                <p className="text-xs text-muted-foreground">Permanent removal of academic staff profile</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-xs text-foreground space-y-1.5">
              <p>
                Are you sure you want to permanently delete faculty member{" "}
                <strong className="font-mono text-rose-600 dark:text-rose-400">
                  {deleteConfirmUser.email}
                </strong>
                ?
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                This will unassign them from classrooms (archiving active classrooms), purge all their submitted journals/drafts, delete uploaded Cloudinary assets, and revoke all administrative credentials.
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
                <span>{deleteMutation.isPending ? "Purging Faculty..." : "Delete Permanently"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
