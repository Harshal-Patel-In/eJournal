"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  ArrowRight,
  FlaskConical,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import { MobileAdaptiveSheet } from "@/components/ui/mobile-adaptive-sheet";
import { formatDateIST } from "@/lib/date";

interface MobileCalendarSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeClassroomId?: string;
}

export function MobileCalendarSheet({
  isOpen,
  onClose,
  activeClassroomId,
}: MobileCalendarSheetProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  // 1. Fetch classrooms
  const { data: classrooms } = useQuery<any[]>({
    queryKey: ["classrooms"],
    queryFn: () => api.get("/classrooms"),
    staleTime: 60000,
  });

  // 2. Fetch assignments for active classroom or first classroom
  const targetClassroomId = activeClassroomId || classrooms?.[0]?.id;

  const { data: assignments } = useQuery<any[]>({
    queryKey: ["classroom-assignments", targetClassroomId],
    queryFn: () => api.get(`/classrooms/${targetClassroomId}/assignments`),
    enabled: !!targetClassroomId,
    staleTime: 60000,
  });

  // 3. Fetch user journals for status coloring
  const { data: journalsRes } = useQuery<any>({
    queryKey: ["student-journals"],
    queryFn: () => api.get("/journals"),
    staleTime: 60000,
  });

  const journals: any[] = useMemo(() => {
    return Array.isArray(journalsRes) ? journalsRes : journalsRes?.data || [];
  }, [journalsRes]);

  // Map assignments and events by YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    if (!assignments) return map;

    const toDateKey = (dateStr: string) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    assignments.forEach((asg: any) => {
      const relatedJournal = journals.find(
        (j: any) => j.assignmentId === asg.id || j.assignment_id === asg.id
      );

      // Lab Session Date
      if (asg.conductedDate) {
        const k = toDateKey(asg.conductedDate);
        if (k) {
          const list = map.get(k) || [];
          list.push({
            id: `${asg.id}-lab`,
            assignment: asg,
            journal: relatedJournal,
            type: "lab_session",
            title: `Lab Session: Exp #${asg.experimentNumber} - ${asg.title}`,
            aim: asg.aim,
            dateStr: asg.conductedDate,
            color: "bg-blue-500",
            textColor: "text-blue-600 dark:text-blue-400",
            bgTint: "bg-blue-500/10 border-blue-500/20",
          });
          map.set(k, list);
        }
      }

      // Cut-off Deadline Date
      if (asg.deadline) {
        const k = toDateKey(asg.deadline);
        if (k) {
          const isPassed = new Date(asg.deadline) < new Date();
          const isDone = relatedJournal?.status === "approved";
          const list = map.get(k) || [];
          list.push({
            id: `${asg.id}-deadline`,
            assignment: asg,
            journal: relatedJournal,
            type: "deadline",
            title: `Submission Due: Exp #${asg.experimentNumber} - ${asg.title}`,
            aim: asg.aim,
            dateStr: asg.deadline,
            isPassed,
            isDone,
            color: isDone ? "bg-emerald-500" : isPassed ? "bg-rose-500" : "bg-amber-500",
            textColor: isDone
              ? "text-emerald-600 dark:text-emerald-400"
              : isPassed
              ? "text-rose-600 dark:text-rose-400"
              : "text-amber-600 dark:text-amber-400",
            bgTint: isDone
              ? "bg-emerald-500/10 border-emerald-500/20"
              : isPassed
              ? "bg-rose-500/10 border-rose-500/20"
              : "bg-amber-500/10 border-amber-500/20",
          });
          map.set(k, list);
        }
      }
    });

    return map;
  }, [assignments, journals]);

  // Calendar Geometry
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleJumpToday = () => {
    const today = new Date();
    setCurrentDate(today);
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    setSelectedDateKey(`${y}-${m}-${d}`);
  };

  const activeDayEvents = selectedDateKey ? eventsByDate.get(selectedDateKey) || [] : [];

  const handleNavigateToEvent = (eventItem: any) => {
    onClose();
    if (eventItem.journal?.id) {
      router.push(`/editor/${eventItem.journal.id}`);
    } else if (targetClassroomId) {
      router.push(`/classrooms/${targetClassroomId}`);
    }
  };

  return (
    <MobileAdaptiveSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Academic Schedule & Deadlines"
      subtitle={classrooms && classrooms.length > 0 ? (classrooms.find(c => c.id === targetClassroomId)?.name || "Academic Calendar") : "Course Schedule"}
    >
      <div className="flex flex-col gap-4 select-none pb-4">
        {/* Month Selector Bar */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground tracking-tight font-serif">
              {monthName}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleJumpToday}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border/80 tap-feedback transition-colors"
            >
              Today
            </button>
            <div className="flex items-center gap-0.5 border border-border/80 rounded-lg p-0.5 bg-muted/30">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous Month"
                className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted tap-feedback transition-colors"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next Month"
                className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted tap-feedback transition-colors"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 7-Day Grid Headers */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted-foreground">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Calendar Day Cells */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells before month start */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="h-10 rounded-lg opacity-20" />
          ))}

          {/* Month Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const mStr = String(month + 1).padStart(2, "0");
            const dStr = String(dayNum).padStart(2, "0");
            const dateKey = `${year}-${mStr}-${dStr}`;

            const today = new Date();
            const isToday =
              today.getFullYear() === year &&
              today.getMonth() === month &&
              today.getDate() === dayNum;

            const isSelected = selectedDateKey === dateKey;
            const events = eventsByDate.get(dateKey) || [];
            const hasEvents = events.length > 0;

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => setSelectedDateKey(dateKey)}
                className={`h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs font-semibold tap-feedback transition-all cursor-pointer relative ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-md scale-105 z-10"
                    : isToday
                    ? "bg-primary/10 text-primary border border-primary/40 font-bold"
                    : "hover:bg-muted/70 text-foreground border border-transparent"
                }`}
              >
                <span className="leading-none text-xs">{dayNum}</span>

                {/* Event Dots */}
                {hasEvents && (
                  <div className="flex items-center gap-0.5">
                    {events.slice(0, 3).map((ev: any, idx: number) => (
                      <span
                        key={idx}
                        className={`size-1.5 rounded-full ${
                          isSelected ? "bg-white" : ev.color
                        }`}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Day Agenda View */}
        <div className="mt-2 pt-3 border-t border-border/70 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <Clock className="size-3.5 text-primary" />
              <span>{selectedDateKey ? formatDateIST(selectedDateKey) : "Select a date"}</span>
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {activeDayEvents.length} {activeDayEvents.length === 1 ? "event" : "events"}
            </span>
          </div>

          {activeDayEvents.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/20 text-center text-xs text-muted-foreground">
              No laboratory practicals or deadlines scheduled for this date.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {activeDayEvents.map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => handleNavigateToEvent(item)}
                  className={`p-3 rounded-xl border flex items-start justify-between gap-3 cursor-pointer tap-feedback transition-all ${item.bgTint}`}
                >
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          item.type === "lab_session"
                            ? "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                            : item.isDone
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                            : item.isPassed
                            ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                            : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {item.type === "lab_session"
                          ? "Lab Session"
                          : item.isDone
                          ? "Completed"
                          : item.isPassed
                          ? "Overdue"
                          : "Deadline"}
                      </span>
                      <span className="text-xs font-bold text-foreground truncate">
                        {item.title}
                      </span>
                    </div>

                    {item.aim && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                        {item.aim}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 pt-0.5">
                    <div className="size-7 rounded-lg bg-card/80 border border-border flex items-center justify-center text-muted-foreground">
                      <ArrowRight className="size-3.5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileAdaptiveSheet>
  );
}

