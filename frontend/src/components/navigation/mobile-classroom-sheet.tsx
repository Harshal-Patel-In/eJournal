"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  GraduationCap,
  BookOpen,
  ArrowRight,
  Sparkles,
  Users,
  FileText,
  Building2,
} from "lucide-react";
import { api } from "@/lib/api";
import { MobileAdaptiveSheet } from "@/components/ui/mobile-adaptive-sheet";
import { getClassroomTheme } from "@/lib/classroom-theme";

interface MobileClassroomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  isTeacher?: boolean;
}

export function MobileClassroomSheet({
  isOpen,
  onClose,
  isTeacher = false,
}: MobileClassroomSheetProps) {
  const router = useRouter();

  const { data: classrooms, isLoading } = useQuery<any[]>({
    queryKey: ["classrooms"],
    queryFn: () => api.get("/classrooms"),
    staleTime: 60000,
  });

  const handleSelectClassroom = (classroomId: string) => {
    onClose();
    router.push(`/classrooms/${classroomId}`);
  };

  return (
    <MobileAdaptiveSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isTeacher ? "Classroom Workspaces" : "Enrolled Subjects & Practicals"}
      subtitle={
        classrooms
          ? `${classrooms.length} active ${classrooms.length === 1 ? "classroom" : "classrooms"}`
          : "Loading..."
      }
    >
      <div className="flex flex-col gap-3 select-none pb-4">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
            Loading your academic classrooms...
          </div>
        ) : !classrooms || classrooms.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-border/80 bg-muted/20 text-center text-xs text-muted-foreground">
            No classroom workspaces found.
          </div>
        ) : (
          classrooms.map((room, idx) => {
            const theme = getClassroomTheme(room.id, idx);

            return (
              <div
                key={room.id}
                onClick={() => handleSelectClassroom(room.id)}
                className="p-3.5 rounded-2xl border border-border/80 bg-card hover:border-border hover:shadow-md transition-all tap-feedback cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`size-10 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 ${theme.badge}`}
                  >
                    <BookOpen className="size-5" />
                  </div>

                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase tracking-wider border ${theme.badge}`}
                      >
                        {room.subjectCode || "LAB"}
                      </span>
                      {room.division && (
                        <span className="text-[10px] font-medium text-muted-foreground">
                          Div {room.division}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm tracking-tight text-foreground truncate">
                      {room.name}
                    </h4>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {room.department} • Semester {room.semester}
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  <div className="size-8 rounded-xl bg-muted/60 border border-border/60 flex items-center justify-center text-muted-foreground">
                    <ArrowRight className="size-4" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </MobileAdaptiveSheet>
  );
}
