"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Users,
  GraduationCap,
  BookOpen,
  FileText,
  Clock,
  CheckCircle2,
  Activity,
  Server,
  Database,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

import { api } from "@/lib/api";
import { formatTimeIST, formatDateTimeIST } from "@/lib/date";
import { Button } from "@/components/ui/button";

function getActionBadge(action: string) {
  const act = (action || "").toUpperCase();

  // 1. Session & Auth
  if (act.includes("LOGGED_IN") || act.includes("LOGIN")) {
    return (
      <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-extrabold border border-emerald-500/30">
        {action}
      </span>
    );
  }
  if (act.includes("LOGGED_OUT") || act.includes("LOGOUT")) {
    return (
      <span className="px-2.5 py-0.5 rounded-md bg-slate-500/12 text-slate-700 dark:text-slate-400 font-mono text-[10px] font-bold border border-slate-500/25">
        {action}
      </span>
    );
  }

  // 2. Security & Credentials
  if (act.includes("PASSWORD") || act.includes("RESET")) {
    return (
      <span className="px-2.5 py-0.5 rounded-md bg-sky-500/12 text-sky-700 dark:text-sky-400 font-mono text-[10px] font-extrabold border border-sky-500/30">
        {action}
      </span>
    );
  }

  // 3. Faculty Onboarding / Provisioning
  if (act.includes("FACULTY")) {
    return (
      <span className="px-2.5 py-0.5 rounded-md bg-purple-500/12 text-purple-700 dark:text-purple-400 font-mono text-[10px] font-extrabold border border-purple-500/30">
        {action}
      </span>
    );
  }

  // 4. Classroom Operations & Management
  if (act.includes("CLASSROOM") || act.includes("REASSIGNED")) {
    return (
      <span className="px-2.5 py-0.5 rounded-md bg-amber-500/12 text-amber-700 dark:text-amber-400 font-mono text-[10px] font-extrabold border border-amber-500/30">
        {action}
      </span>
    );
  }

  // 5. Account Lifecycle / Suspension
  if (act.includes("STATUS") || act.includes("SUSPEND") || act.includes("DELETE") || act.includes("ARCHIVE")) {
    return (
      <span className="px-2.5 py-0.5 rounded-md bg-rose-500/12 text-rose-700 dark:text-rose-400 font-mono text-[10px] font-extrabold border border-rose-500/30">
        {action}
      </span>
    );
  }

  // 6. Journal & Academic Workflows
  if (act.includes("JOURNAL") || act.includes("SUBMITTED") || act.includes("APPROVED")) {
    return (
      <span className="px-2.5 py-0.5 rounded-md bg-blue-500/12 text-blue-700 dark:text-blue-400 font-mono text-[10px] font-extrabold border border-blue-500/30">
        {action}
      </span>
    );
  }

  // 7. General Registration
  if (act.includes("REGISTER")) {
    return (
      <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/12 text-indigo-700 dark:text-indigo-400 font-mono text-[10px] font-extrabold border border-indigo-500/30">
        {action}
      </span>
    );
  }

  return (
    <span className="px-2.5 py-0.5 rounded-md bg-muted text-foreground font-mono text-[10px] font-semibold border border-border">
      {action}
    </span>
  );
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading, refetch, isRefetching } = useQuery<any>({
    queryKey: ["admin-stats"],
    queryFn: () => api.get("/admin/stats"),
    refetchInterval: 15000, // Auto-refresh every 15s
  });

  const kpis = [
    {
      title: "Total Students",
      value: stats?.totalStudents ?? "—",
      subtext: "Verified student profiles",
      icon: GraduationCap,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
      hoverBorder: "hover:border-blue-500/50 hover:shadow-blue-500/10",
      arrowColor: "group-hover:text-blue-500",
      href: "/admin/students",
    },
    {
      title: "Faculty Members",
      value: stats?.totalFaculty ?? "—",
      subtext: "Active professors & instructors",
      icon: Users,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/20",
      hoverBorder: "hover:border-purple-500/50 hover:shadow-purple-500/10",
      arrowColor: "group-hover:text-purple-500",
      href: "/admin/faculty",
    },
    {
      title: "Active Classrooms",
      value: stats?.activeClassrooms ?? "—",
      subtext: "Operational laboratory courses",
      icon: BookOpen,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
      hoverBorder: "hover:border-emerald-500/50 hover:shadow-emerald-500/10",
      arrowColor: "group-hover:text-emerald-500",
      href: "/admin/classrooms",
    },
    {
      title: "Global Journals",
      value: stats?.totalJournals ?? "—",
      subtext: "Document records created",
      icon: FileText,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-500/10 border-indigo-500/20",
      hoverBorder: "hover:border-indigo-500/50 hover:shadow-indigo-500/10",
      arrowColor: "group-hover:text-indigo-500",
      href: "/admin/journals",
    },
    {
      title: "Pending Evaluations",
      value: stats?.pendingSubmissions ?? "—",
      subtext: "Turned in, awaiting review",
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
      hoverBorder: "hover:border-amber-500/50 hover:shadow-amber-500/10",
      arrowColor: "group-hover:text-amber-500",
      href: "/admin/journals?status=submitted",
    },
    {
      title: "Approved Practical Records",
      value: stats?.approvedJournals ?? "—",
      subtext: "Graded & officially signed off",
      icon: CheckCircle2,
      color: "text-teal-600 dark:text-teal-400",
      bg: "bg-teal-500/10 border-teal-500/20",
      hoverBorder: "hover:border-teal-500/50 hover:shadow-teal-500/10",
      arrowColor: "group-hover:text-teal-500",
      href: "/admin/journals?status=approved",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Institutional Command Center</h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold border border-emerald-500/20 flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Campus-wide laboratory metrics, security compliance health, and real-time audit stream
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
            <span>Refresh Feed</span>
          </Button>

          <Link href="/admin/faculty">
            <Button size="sm" className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer shadow-sm">
              <Users className="size-3.5" />
              <span>Provision Faculty</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={idx}
              href={kpi.href}
              className={`p-5 rounded-3xl bg-card border border-border/80 ${kpi.hoverBorder} hover:shadow-lg transition-all duration-200 flex flex-col justify-between gap-4 group`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">{kpi.title}</span>
                  <div className="text-2xl font-black text-foreground tracking-tight tabular-nums">
                    {isLoading ? <div className="h-8 w-16 bg-muted/60 animate-pulse rounded-lg" /> : kpi.value}
                  </div>
                </div>
                <div className={`size-10 rounded-2xl ${kpi.bg} ${kpi.color} flex items-center justify-center font-bold border shrink-0 group-hover:scale-105 transition-transform`}>
                  <Icon className="size-5" />
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                <span>{kpi.subtext}</span>
                <ArrowUpRight className={`size-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-muted-foreground ${kpi.arrowColor}`} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Bottom 2-Column: System Health & Live Audit Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Health & Infrastructure */}
        <div className="p-6 rounded-3xl bg-card border border-border/80 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <Server className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Infrastructure Health</h3>
                <p className="text-[11px] text-muted-foreground">Live datastores & telemetry</p>
              </div>
            </div>
            <span className="size-2 rounded-full bg-emerald-500 animate-ping" title="Telemetry Active" />
          </div>

          <div className="space-y-3 pt-1">
            {/* MongoDB Telemetry */}
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Database className="size-4 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    MongoDB {stats?.health?.database?.name ? `(${stats.health.database.name})` : "Atlas"}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">
                    {stats?.health?.database?.host || "eJournal Primary Datastore"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {stats?.health?.database?.latencyMs != null && (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/20">
                    {stats.health.database.latencyMs}ms
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                    stats?.health?.database?.status === "connected"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                  }`}
                >
                  {stats?.health?.database?.status === "connected" ? "Connected" : "Offline"}
                </span>
              </div>
            </div>

            {/* Redis Telemetry */}
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Zap className="size-4 text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">Redis Cache & Rate Limiter</p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">
                    {stats?.health?.redis?.host || "Session storage"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {stats?.health?.redis?.latencyMs != null && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-bold border border-amber-500/20">
                    {stats.health.redis.latencyMs}ms
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                    stats?.health?.redis?.status === "optimal" || stats?.health?.redis?.status === "connected"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : stats?.health?.redis?.status === "unavailable"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                  }`}
                >
                  {stats?.health?.redis?.status === "optimal"
                    ? "Optimal"
                    : stats?.health?.redis?.status === "connected"
                    ? "Connected"
                    : stats?.health?.redis?.status === "unavailable"
                    ? "Standby"
                    : "Offline"}
                </span>
              </div>
            </div>

            {/* FastAPI Telemetry */}
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Activity className="size-4 text-sky-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">FastAPI Core Runtime</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    Env: <span className="font-semibold text-foreground">{stats?.health?.environment || "production"}</span>
                    {stats?.health?.uptimeSeconds ? ` • Uptime: ${Math.floor(stats.health.uptimeSeconds / 60)}m` : ""}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[10px] font-bold border border-sky-500/20">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Live Recent Activity Stream */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-card border border-border/80 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <Activity className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Recent Security Audit Events</h3>
                <p className="text-[11px] text-muted-foreground">Real-time platform activity stream (last 5 days)</p>
              </div>
            </div>
            <Link href="/admin/audit-logs">
              <Button variant="ghost" size="sm" className="text-xs font-semibold rounded-xl text-primary cursor-pointer hover:bg-primary/10">
                View Full Logs →
              </Button>
            </Link>
          </div>

          <div className="divide-y divide-border/50">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Loading activity stream...</div>
            ) : !stats?.recentActivity || stats.recentActivity.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No recent audit events logged.</div>
            ) : (
              stats.recentActivity.map((event: any) => (
                <div key={event.id} className="py-3 flex items-center justify-between text-xs gap-3 hover:bg-muted/20 px-2 rounded-xl transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    {getActionBadge(event.action)}
                    <span className="text-muted-foreground truncate">
                      by <strong className="text-foreground">{event.userEmail || "System"}</strong>
                    </span>
                    {event.ipAddress && (
                      <span className="text-[10px] text-muted-foreground/60 hidden sm:inline font-mono">
                        ({event.ipAddress})
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[11px] text-muted-foreground shrink-0 font-medium font-mono"
                    title={formatDateTimeIST(event.timestamp)}
                  >
                    {formatTimeIST(event.timestamp, false)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

