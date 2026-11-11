"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  BookOpen,
  User,
  ShieldAlert,
  Bell,
  GraduationCap,
} from "lucide-react";
import { api } from "@/lib/api";

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

  // Hide on public landing, auth pages, and immersive full-screen document editor
  const isAuthPage = pathname.startsWith("/auth");
  const isLandingPage = pathname === "/";
  const isEditorPage = pathname.startsWith("/editor");
  const isCompilePage = pathname.includes("/compile-journal");

  // Fetch active authenticated user profile
  const { data: user } = useQuery<ProfileResponse>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile"),
    retry: false,
    staleTime: 60000,
    enabled: !isAuthPage && !isLandingPage,
  });

  // Fetch unread notifications count for live badge
  const { data: notificationsData } = useQuery<any>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications"),
    retry: false,
    staleTime: 30000,
    enabled: !!user && !isAuthPage && !isLandingPage,
  });

  if (isAuthPage || isLandingPage || isEditorPage || isCompilePage || !user) {
    return null;
  }

  const isTeacher = user.role === "teacher";
  const isAdmin = user.role === "admin" || user.is_admin || user.isAdmin;

  const unreadCount: number =
    notificationsData?.unreadCount ??
    notificationsData?.items?.filter((n: any) => !n.is_read && !n.isRead)?.length ??
    0;

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
      href: "/dashboard#classrooms",
      icon: GraduationCap,
      isActive: pathname.startsWith("/classrooms"),
    },
    {
      label: "Alerts",
      href: "/dashboard#notifications",
      icon: Bell,
      badge: unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : null,
      isActive: false,
      onClick: () => {
        // Dispatch custom event to open notification drawer cleanly
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("ejournal:open-notifications"));
        }
      },
    },
    {
      label: "Profile",
      href: "/profile",
      icon: User,
      isActive: pathname.startsWith("/profile"),
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
      }}
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/90 dark:bg-zinc-950/90 backdrop-blur-xl border-t border-border/80 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] transition-all duration-200 select-none"
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
                className="relative flex flex-col items-center justify-center flex-1 h-full py-1 text-muted-foreground hover:text-foreground tap-feedback touch-target-44 cursor-pointer"
              >
                <div className="relative">
                  <Icon className="size-5 transition-transform" />
                  {item.badge && (
                    <span className="absolute -top-1 -right-2 px-1 min-w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground font-black text-[9px] flex items-center justify-center shadow-xs">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium tracking-tight mt-1 truncate">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
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
  );
}

