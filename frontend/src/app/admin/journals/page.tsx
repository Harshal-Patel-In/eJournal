"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileEdit,
  Loader2,
  RefreshCw,
  Award,
} from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const STATUS_TABS = [
  { id: "all", label: "All Records" },
  { id: "draft", label: "Drafts" },
  { id: "submitted", label: "Submitted" },
  { id: "late_submitted", label: "Late Hand In" },
  { id: "changes_requested", label: "Changes Requested" },
  { id: "approved", label: "Approved & Graded" },
];

export default function AdminJournalsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch, isRefetching } = useQuery<any>({
    queryKey: ["admin-journals", statusFilter, search, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: page.toString(), limit: "20" });
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      return api.get(`/admin/journals?${params.toString()}`);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 className="size-3" /> Approved
          </span>
        );
      case "submitted":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
            <Clock className="size-3" /> Handed In
          </span>
        );
      case "late_submitted":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
            <AlertCircle className="size-3" /> Late Hand In
          </span>
        );
      case "changes_requested":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <AlertCircle className="size-3" /> Revisions Needed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-muted text-muted-foreground border border-border flex items-center gap-1">
            <FileEdit className="size-3" /> Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">Global Academic Journal Oversight</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Institutional birds-eye visibility of laboratory practical submissions across all classrooms
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="rounded-xl h-10 sm:h-8 px-3 text-xs font-semibold gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 p-1 bg-muted/40 border border-border/70 rounded-2xl overflow-x-auto no-scrollbar">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3.5 py-2 sm:py-1.5 rounded-xl text-xs font-semibold transition-[background-color,color,box-shadow] cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === tab.id
                  ? "bg-card text-foreground shadow-xs border border-border/80 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by practical title, student name, or enrollment number..."
            className="w-full pl-10 pr-4 py-2.5 sm:py-2 rounded-2xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Journals Registry (Adaptive Mobile Cards + Desktop Table) */}
      <div className="rounded-3xl bg-card border border-border/80 overflow-hidden shadow-xs">
        {/* Mobile & Tablet Cards (< 1024px) */}
        <div className="lg:hidden p-3.5 sm:p-4 space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              <Loader2 className="size-5 animate-spin mx-auto mb-2 text-primary" />
              Loading academic journal records…
            </div>
          ) : !data?.journals || data.journals.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              No academic journals found matching your filter criteria.
            </div>
          ) : (
            data.journals.map((j: any) => (
              <div
                key={j.id}
                className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-foreground text-xs leading-snug">
                        {j.title}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-muted border border-border text-muted-foreground">
                        v{j.currentVersion}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {j.assignmentTitle}
                    </p>
                  </div>
                  <div className="shrink-0">{getStatusBadge(j.status)}</div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs">
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground block truncate">
                      {j.studentName}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {j.enrollmentNumber} · {j.classroomTitle}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    {j.marks !== undefined && j.marks !== null ? (
                      <span className="inline-flex items-center gap-1 font-bold text-foreground tabular-nums">
                        <span className="font-semibold">{j.marks}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">pts</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 italic text-[11px]">Pending</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Registry Table (>= 1024px) */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="py-3 px-5">Practical Record</th>
                <th className="py-3 px-4">Student & Roll No</th>
                <th className="py-3 px-4">Classroom</th>
                <th className="py-3 px-4">Evaluation Status</th>
                <th className="py-3 px-4 text-right">Marks / Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="size-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading academic journal records...
                  </td>
                </tr>
              ) : !data?.journals || data.journals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    No academic journals found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                data.journals.map((j: any) => (
                  <tr key={j.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground text-xs">{j.title}</span>
                          <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-muted border border-border text-muted-foreground">
                            v{j.currentVersion}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">{j.assignmentTitle}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground text-xs">{j.studentName}</span>
                        <span className="text-[10px] text-muted-foreground">{j.enrollmentNumber}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground text-xs font-medium">
                      {j.classroomTitle}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(j.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {j.marks !== undefined && j.marks !== null ? (
                        <div className="inline-flex items-center gap-1.5 font-bold text-foreground">
                          <Award className="size-3 text-amber-500" />
                          <span className="tabular-nums font-semibold">{j.marks}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">pts</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40 italic text-[11px]">Pending</span>
                      )}
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
