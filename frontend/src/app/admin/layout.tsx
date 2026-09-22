"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  FileText,
  ShieldAlert,
  LogOut,
  KeyRound,
  ShieldCheck,
  Menu,
  X,
  Loader2,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeft,
} from "lucide-react";

import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
  {
    label: "Command Center",
    href: "/admin",
    icon: LayoutDashboard,
    activeBg: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
    activeIcon: "text-indigo-600 dark:text-indigo-400",
    hoverIcon: "group-hover:text-indigo-500",
  },
  {
    label: "Faculty Management",
    href: "/admin/faculty",
    icon: Users,
    activeBg: "bg-purple-500/12 text-purple-700 dark:text-purple-400 border-purple-500/30",
    activeIcon: "text-purple-600 dark:text-purple-400",
    hoverIcon: "group-hover:text-purple-500",
  },
  {
    label: "Student Directory",
    href: "/admin/students",
    icon: GraduationCap,
    activeBg: "bg-sky-500/12 text-sky-700 dark:text-sky-400 border-sky-500/30",
    activeIcon: "text-sky-600 dark:text-sky-400",
    hoverIcon: "group-hover:text-sky-500",
  },
  {
    label: "Classroom Supervision",
    href: "/admin/classrooms",
    icon: BookOpen,
    activeBg: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    activeIcon: "text-emerald-600 dark:text-emerald-400",
    hoverIcon: "group-hover:text-emerald-500",
  },
  {
    label: "Global Journals",
    href: "/admin/journals",
    icon: FileText,
    activeBg: "bg-rose-500/12 text-rose-700 dark:text-rose-400 border-rose-500/30",
    activeIcon: "text-rose-600 dark:text-rose-400",
    hoverIcon: "group-hover:text-rose-500",
  },
  {
    label: "Security Audit Logs",
    href: "/admin/audit-logs",
    icon: ShieldAlert,
    activeBg: "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/30",
    activeIcon: "text-amber-600 dark:text-amber-400",
    hoverIcon: "group-hover:text-amber-500",
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Restore collapsed preference on mount
  useEffect(() => {
    const saved = localStorage.getItem("admin_sidebar_collapsed");
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("admin_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Password modal states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Profile data
  const { data: user, isLoading } = useQuery<any>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile"),
    retry: false,
  });

  // Password Change Mutation
  const passwordMutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      api.post<{ message: string }>("/admin/change-password", data),
    onSuccess: () => {
      toast.success("Administrator password updated successfully!", { title: "Security Updated" });
      setShowPasswordModal(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError(null);
    },
    onError: (err: any) => {
      setPasswordError(err.message || "Failed to update password. Verify current password.");
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    passwordMutation.mutate({
      current_password: currentPassword,
      new_password: newPassword,
    });
  };

  const handleSignOut = async () => {
    try {
      await api.post("/auth/logout", {});
    } catch (e) {
      // Ignore network errors on logout
    }
    if (typeof window !== "undefined") {
      document.cookie = "access_token=; path=/; max-age=0; SameSite=Lax";
    }
    queryClient.clear();
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-zinc-950 text-foreground selection:bg-amber-500/10">
      {/* 1. Desktop Liquid Glass Collapsible Sidebar */}
      <aside
        data-no-tooltip="true"
        className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 bg-card/75 dark:bg-zinc-900/80 backdrop-blur-2xl backdrop-saturate-180 border-r border-border/70 justify-between transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isCollapsed ? "w-20 p-3" : "w-72 p-5"
        }`}
      >
        <div className="space-y-6">
          {/* Institution Brand Header */}
          <div className="flex items-center justify-between px-1 pt-1">
            <Link
              href="/admin"
              className={`flex items-center gap-2.5 group overflow-hidden ${
                isCollapsed ? "justify-center w-full" : ""
              }`}
            >
              <img
                src="/logo.png"
                alt="eJournal Logo"
                className="size-8 object-contain shrink-0 group-hover:scale-105 transition-transform"
              />
              {!isCollapsed && (
                <div className="flex flex-col min-w-0 transition-opacity duration-200">
                  <span className="text-sm font-black tracking-tight text-foreground flex items-center gap-1.5">
                    eJournal
                    <span className="px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-extrabold uppercase border border-amber-500/20">
                      Admin
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground font-medium truncate">
                    Institutional Authority
                  </span>
                </div>
              )}
            </Link>

            {/* Collapse/Expand Toggle Button (Apple HIG style) */}
            {!isCollapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center transition-colors cursor-pointer"
              >
                <PanelLeftClose className="size-4" />
              </button>
            )}
          </div>

          {/* Quick Expand Button when collapsed */}
          {isCollapsed && (
            <div className="flex justify-center pb-1">
              <button
                type="button"
                onClick={toggleSidebar}
                className="size-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 flex items-center justify-center transition-all cursor-pointer border border-border/50"
              >
                <PanelLeftOpen className="size-4" />
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <div key={item.href} className="relative group">
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-[0.98] ${
                      isCollapsed ? "justify-center px-0" : ""
                    } ${
                      isActive
                        ? `${item.activeBg} font-bold shadow-xs border`
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <Icon
                      className={`size-4.5 shrink-0 transition-transform group-hover:scale-105 ${
                        isActive ? item.activeIcon : item.hoverIcon
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </Link>

                  {/* Apple HIG Floating Glass Tooltip in Collapsed Mode */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-xl bg-popover/95 dark:bg-zinc-800/95 backdrop-blur-xl border border-border text-foreground text-xs font-bold whitespace-nowrap shadow-xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 pointer-events-none z-50">
                      {item.label}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Quick Switch to Academic Workspace */}
            <div className="pt-2 border-t border-border/40 relative group">
              <Link
                href="/dashboard"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200 group ${
                  isCollapsed ? "justify-center px-0" : ""
                }`}
              >
                <ArrowLeft className="size-4.5 shrink-0 transition-transform group-hover:-translate-x-0.5 text-muted-foreground group-hover:text-primary" />
                {!isCollapsed && <span className="truncate">Academic Workspace</span>}
              </Link>

              {/* Apple HIG Floating Glass Tooltip in Collapsed Mode */}
              {isCollapsed && (
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-xl bg-popover/95 dark:bg-zinc-800/95 backdrop-blur-xl border border-border text-foreground text-xs font-bold whitespace-nowrap shadow-xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 pointer-events-none z-50">
                  Academic Workspace
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Footer Admin Profile & Actions */}
        <div className="space-y-3 pt-4 border-t border-border/60">
          {/* Admin Profile Pill */}
          {!isCollapsed ? (
            <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-between">
              <div className="flex flex-col min-w-0 pr-2">
                <span className="text-xs font-bold text-foreground truncate">
                  {user?.fullName || "Super Administrator"}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {user?.email || "admin@ejournal.com"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="size-7 rounded-lg bg-background border border-border/80 text-muted-foreground hover:text-foreground hover:border-amber-500/40 flex items-center justify-center transition-all cursor-pointer"
              >
                <KeyRound className="size-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="size-9 rounded-xl bg-muted/50 border border-border/80 text-muted-foreground hover:text-foreground hover:border-amber-500/40 flex items-center justify-center transition-all cursor-pointer"
              >
                <KeyRound className="size-4" />
              </button>
            </div>
          )}

          {/* Quick Sign Out & Theme Bar */}
          <div
            className={`flex items-center ${
              isCollapsed ? "flex-col gap-2 justify-center" : "justify-between px-1"
            }`}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className={`text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 h-8 px-2 cursor-pointer rounded-xl gap-1.5 ${
                isCollapsed ? "size-9 p-0 justify-center" : "-ml-2"
              }`}
            >
              <LogOut className="size-3.5" />
              {!isCollapsed && <span>Sign Out</span>}
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* 2. Mobile Responsive Top Header */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-card/85 dark:bg-zinc-900/85 backdrop-blur-xl border-b border-border/70 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="eJournal Logo" className="size-7 object-contain" />
          <span className="text-sm font-bold text-foreground">eJournal Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="size-8 rounded-xl cursor-pointer"
          >
            {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-y-0 left-0 w-64 bg-card p-5 flex flex-col justify-between border-r border-border">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="eJournal" className="size-6 object-contain" />
                  <span className="text-sm font-bold text-foreground">Navigation</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(false)}
                  className="size-7 rounded-lg"
                >
                  <X className="size-4" />
                </Button>
              </div>
              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const isActive =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${
                        isActive
                          ? `${item.activeBg} font-bold border`
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                <div className="pt-2 border-t border-border/40">
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted"
                  >
                    <ArrowLeft className="size-4" />
                    <span>Academic Workspace</span>
                  </Link>
                </div>
              </nav>
            </div>
            <div className="pt-4 border-t border-border space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowPasswordModal(true);
                }}
                className="w-full text-xs font-semibold rounded-xl gap-2 cursor-pointer"
              >
                <KeyRound className="size-3.5" />
                <span>Change Password</span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleSignOut}
                className="w-full text-xs font-semibold rounded-xl gap-2 cursor-pointer"
              >
                <LogOut className="size-3.5" />
                <span>Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Dashboard Content Canvas with Dynamic Synchronization */}
      <main
        className={`flex-1 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isCollapsed ? "lg:pl-20" : "lg:pl-72"
        } w-full pt-16 lg:pt-0 min-h-screen`}
      >
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
      </main>


      {/* 4. Password Change Security Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-50 duration-150">
          <div className="w-full max-w-md rounded-3xl bg-card border border-border/80 p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <KeyRound className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Update Admin Password</h3>
                  <p className="text-[11px] text-muted-foreground">Sets a private, strong password</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {passwordError && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                {passwordError}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">New Strong Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPasswordModal(false)}
                  className="rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={passwordMutation.isPending}
                  className="rounded-xl text-xs font-bold cursor-pointer"
                >
                  {passwordMutation.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
