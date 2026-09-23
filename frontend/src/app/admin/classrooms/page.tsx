"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Search,
  UserCheck,
  Users,
  FileText,
  Key,
  ArrowRightLeft,
  Loader2,
  X,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";

export default function AdminClassroomsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reassignTarget, setReassignTarget] = useState<any>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  // Fetch Classrooms
  const { data, isLoading, refetch, isRefetching } = useQuery<any>({
    queryKey: ["admin-classrooms", search, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: page.toString(), limit: "15" });
      if (search) params.set("search", search);
      return api.get(`/admin/classrooms?${params.toString()}`);
    },
  });

  // Fetch Available Faculty for Reassignment
  const { data: facultyData } = useQuery<any>({
    queryKey: ["admin-faculty-options"],
    queryFn: () => api.get("/admin/users?role=teacher&limit=100"),
    enabled: !!reassignTarget,
  });

  // Reassign Classroom Mutation
  const reassignMutation = useMutation({
    mutationFn: ({ classroomId, newTeacherId }: { classroomId: string; newTeacherId: string }) =>
      api.patch<any>(`/admin/classrooms/${classroomId}/reassign`, { newTeacherId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-classrooms"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Classroom instructor reassigned successfully! Student records preserved.", {
        title: "Academic Continuity Maintained",
      });
      setReassignTarget(null);
      setSelectedTeacherId("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reassign classroom");
    },
  });

  const handleReassignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId) {
      toast.error("Please select a target faculty instructor");
      return;
    }
    reassignMutation.mutate({
      classroomId: reassignTarget.id,
      newTeacherId: selectedTeacherId,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Classroom Supervision & Academic Continuity</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Oversee university lab practical courses, student enrollments, and transfer instructors
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
          <span>Refresh</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search classrooms by subject code (e.g. CS301), title, or join code..."
          className="w-full pl-10 pr-4 py-2 rounded-2xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
        />
      </div>

      {/* Classrooms Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin mx-auto mb-2 text-primary" />
            Loading classrooms...
          </div>
        ) : !data?.classrooms || data.classrooms.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            No classrooms found matching your search.
          </div>
        ) : (
          data.classrooms.map((c: any) => (
            <div
              key={c.id}
              className="p-5 rounded-3xl bg-card border border-border/80 hover:border-amber-500/30 transition-all flex flex-col justify-between gap-4 shadow-xs"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-mono font-bold text-muted-foreground border border-border">
                      {c.subjectCode || "LAB"}
                    </span>
                    <h3 className="text-sm font-bold text-foreground mt-1.5 leading-snug">{c.name}</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                    {c.joinCode}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-muted/30 border border-border/60 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <UserCheck className="size-3.5 text-primary" />
                      Instructor:
                    </span>
                    <span className="font-bold text-foreground truncate max-w-[150px]">{c.teacherName}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Users className="size-3.5 text-blue-500" />
                      Enrolled Students:
                    </span>
                    <span className="font-bold text-foreground tabular-nums">{c.studentCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <FileText className="size-3.5 text-emerald-500" />
                      Assignments:
                    </span>
                    <span className="font-bold text-foreground tabular-nums">{c.assignmentCount}</span>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReassignTarget(c);
                  setSelectedTeacherId("");
                }}
                className="w-full rounded-xl text-xs font-semibold gap-1.5 cursor-pointer hover:border-amber-500/40"
              >
                <ArrowRightLeft className="size-3.5" />
                <span>Reassign Instructor</span>
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Reassign Classroom Modal */}
      {reassignTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-50 duration-150">
          <div className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <ArrowRightLeft className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Reassign Course Instructor</h3>
                  <p className="text-[11px] text-muted-foreground">{reassignTarget.name} ({reassignTarget.subjectCode})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReassignTarget(null)}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="size-4" /> Academic Continuity Invariant
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                All historical student submissions, assignments, annotations, and awarded marks will remain 100% intact and transfer to the new instructor.
              </p>
            </div>

            <form onSubmit={handleReassignSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Select New Faculty Member</label>
                <CustomSelect
                  value={selectedTeacherId}
                  onChange={(val) => setSelectedTeacherId(val)}
                  options={[
                    { value: "", label: "-- Choose Verified Professor --" },
                    ...(facultyData?.users?.map((f: any) => ({
                      value: f.id,
                      label: `${f.profile?.name || f.email} (${f.profile?.department || "Faculty"})`,
                    })) || []),
                  ]}
                  placeholder="-- Choose Verified Professor --"
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReassignTarget(null)}
                  className="rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={reassignMutation.isPending || !selectedTeacherId}
                  className="rounded-xl text-xs font-bold cursor-pointer"
                >
                  {reassignMutation.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      Reassigning...
                    </>
                  ) : (
                    "Confirm Transfer"
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
