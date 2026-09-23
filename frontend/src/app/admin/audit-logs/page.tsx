"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  RefreshCw,
  Loader2,
  Calendar,
  Laptop,
  User,
  Activity,
} from "lucide-react";

import { api } from "@/lib/api";
import { formatDateTimeIST } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";

const ACTION_OPTIONS = [
  { value: "all", label: "All Audit Actions" },
  { value: "USER_LOGGED_IN", label: "USER_LOGGED_IN" },
  { value: "USER_REGISTERED", label: "USER_REGISTERED" },
  { value: "FACULTY_CREATED", label: "FACULTY_CREATED" },
  { value: "USER_STATUS_UPDATED", label: "USER_STATUS_UPDATED" },
  { value: "USER_PASSWORD_RESET", label: "USER_PASSWORD_RESET" },
  { value: "PASSWORD_CHANGED", label: "PASSWORD_CHANGED" },
  { value: "CLASSROOM_CREATED", label: "CLASSROOM_CREATED" },
  { value: "CLASSROOM_REASSIGNED", label: "CLASSROOM_REASSIGNED" },
  { value: "JOURNAL_SUBMITTED", label: "JOURNAL_SUBMITTED" },
  { value: "JOURNAL_APPROVED", label: "JOURNAL_APPROVED" },
];

export default function AdminAuditLogsPage() {
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch, isRefetching } = useQuery<any>({
    queryKey: ["admin-audit-logs", actionFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: page.toString(), limit: "30" });
      if (actionFilter && actionFilter !== "all") params.set("action", actionFilter);
      return api.get(`/admin/audit-logs?${params.toString()}`);
    },
  });

  const getActionBadge = (action: string) => {
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
  };


  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Security Audit Trail</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track institutional activity, authentication events, and administrative actions over the past 5 days
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
          <span>Refresh Logs</span>
        </Button>
      </div>

      {/* Compliance Information Card */}
      <div className="p-4 rounded-3xl bg-card border border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">5-Day Security Retention Policy</h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Logs record actor identification, target resource, and client IP addresses. Automatically retains events from the last 5 days.
            </p>
          </div>
        </div>

        {/* Action Filter */}
        <div className="w-full sm:w-auto">
          <CustomSelect
            value={actionFilter}
            onChange={(val) => {
              setActionFilter(val);
              setPage(1);
            }}
            options={ACTION_OPTIONS}
            placeholder="All Audit Actions"
            className="w-full sm:w-64"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-3xl bg-card border border-border/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="py-3 px-5">Action Event</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Target Resource</th>
                <th className="py-3 px-4">Client IP</th>
                <th className="py-3 px-5 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="size-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : !data?.logs || data.logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    No audit records found matching this event filter.
                  </td>
                </tr>
              ) : (
                data.logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-5">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <User className="size-3 text-muted-foreground" />
                        <span>{log.userEmail}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-muted-foreground font-mono text-[11px]">
                        {log.entity}
                        {log.entityId ? `:${log.entityId.slice(-6)}` : ""}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] text-muted-foreground flex items-center gap-1">
                        <Laptop className="size-3" />
                        {log.ipAddress}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatDateTimeIST(log.timestamp)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
