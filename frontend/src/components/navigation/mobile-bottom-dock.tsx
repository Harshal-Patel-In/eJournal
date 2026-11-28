"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  BookOpen,
  User,
  ShieldAlert,
  Calendar as CalendarIcon,
  GraduationCap,
} from "lucide-react";
import { api } from "@/lib/api";
import { MobileCalendarSheet } from "./mobile-calendar-sheet";
import { MobileClassroomSheet } from "./mobile-classroom-sheet";

interface ProfileResponse {
  id?: string;
  role?: "student" | "teacher" | "admin";
  is_admin?: boolean;
  isAdmin?: boolean;
  profile?: {
    name?: string;
    enrollmentNumber?: string;
  };
}

/**
 * MobileBottomDock — Persistent Touch-Ergonomic Mobile Navigation Dock.
 *
 * Grounded in:
 * - Apple HIG Bottom Tab Bar & Safe Area Guidelines
 * - Fitts's Law (Primary destinations anchored in the thumb-reachable bottom 15% of viewport)
 * - Emil Kowalski Active State Spring Physics & Tap Feedback
 * - Auto-Hiding during distraction-free Editor mode (`/editor/*`) and Auth flows (`/auth/*`)
 */
export function MobileBottomDock() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isClassroomOpen, setIsClassroomOpen] = useState(false);

  // Hide on public landing, auth pages, profile setup, admin suite, and full-screen document editor
  const isAuthPage = pathname.startsWith("/auth");
  const isLandingPage = pathname === "/";
  const isEditorPage = pathname.startsWith("/editor");
  const isCompilePage = pathname.includes("/compile-journal");
  const isAdminPage = pathname.startsWith("/admin");
  const isProfileSetupPage = pathname.startsWith("/profile/setup");

  // Fetch active authenticated user profile
  const { data: user } = useQuery<ProfileResponse>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile"),
    retry: false,
    staleTime: 60000,
    enabled: !isAuthPage && !isLandingPage && !isAdminPage && !isProfileSetupPage,
  });

  // Fetch enrolled/managed classrooms for smart contextual navigation
  const { data: classrooms } = useQuery<any[]>({
    queryKey: ["classrooms"],
    queryFn: () => api.get("/classrooms"),
    staleTime: 60000,
    enabled: !isAuthPage && !isLandingPage && !isAdminPage && !isProfileSetupPage && !!user,
  });

  if (
    isAuthPage ||
    isLandingPage ||
    isEditorPage ||
    isCompilePage ||
    isAdminPage ||
    isProfileSetupPage ||
    !user ||
    user.role === "admin"
  ) {
    return null;
  }

  const isTeacher = user.role === "teacher";
  const isAdmin = Boolean(user.is_admin || user.isAdmin);

  // Context-aware handler for Practicals / Classrooms tap
  const handleClassroomsClick = () => {
    // 1. If currently inside a classroom page (/classrooms/[id])
    if (pathname.startsWith("/classrooms/")) {
      // If user scrolled down the practicals list, smoothly scroll to top
      if (typeof window !== "undefined" && window.scrollY > 80) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      // If already at top, open the practicals hub to quickly jump to any practical or switch subjects
      setIsClassroomOpen(true);
      return;
    }

    // 2. Otherwise (dashboard or any other page), open the interactive practicals hub
    setIsClassroomOpen(true);
  };

  // Build ergonomic navigation destinations
  const navItems = [
    {
      label: isTeacher ? "Console" : "Workspace",
      href: "/dashboard",
      icon: isTeacher ? LayoutDashboard : BookOpen,
      isActive: pathname === "/dashboard",
    },
    ...(isAdmin
      ? [
          {
            label: "Admin",
            href: "/admin",
            icon: ShieldAlert,
            isActive: pathname.startsWith("/admin"),
          },
        ]
      : []),
    {
      label: isTeacher ? "Classrooms" : "Practicals",
      icon: GraduationCap,
      isActive: pathname.startsWith("/classrooms"),
      onClick: handleClassroomsClick,
    },
    {
      label: "Calendar",
      icon: CalendarIcon,
      isActive: isCalendarOpen,
      onClick: () => setIsCalendarOpen(true),
    },
    {
      label: "Profile",
      href: "/profile",
      icon: User,
      isActive: pathname.startsWith("/profile"),
    },
  ];

  return (
    <>
      <nav
        aria-label="Mobile Bottom Navigation"
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 12px))",
        }}
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 dark:bg-zinc-950/95 backdrop-blur-xl border-t border-border/80 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] transition-all duration-200 select-none"
      >
        <div className="flex items-center justify-around px-2 pt-1.5 h-14">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.isActive;

            if (item.onClick) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-150 tap-feedback touch-target-44 cursor-pointer ${
                    active
                      ? "text-primary font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="relative">
                    <Icon className={`size-5 transition-transform ${active ? "scale-110 text-primary" : ""}`} />
                    {active && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] tracking-tight mt-1 truncate ${
                      active ? "font-bold text-foreground" : "font-medium"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href!}
                className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-150 tap-feedback touch-target-44 ${
                  active
                    ? "text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="relative">
                  <Icon className={`size-5 transition-transform ${active ? "scale-110" : ""}`} />
                  {active && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                  )}
                </div>
                <span
                  className={`text-[10px] tracking-tight mt-1 truncate ${
                    active ? "font-bold text-foreground" : "font-medium"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Interactive Mobile Academic Calendar Sheet */}
      <MobileCalendarSheet
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
      />

      {/* Fast Classroom & Subject Switcher Sheet */}
      <MobileClassroomSheet
        isOpen={isClassroomOpen}
        onClose={() => setIsClassroomOpen(false)}
        isTeacher={isTeacher}
      />
    </>
  );
}

