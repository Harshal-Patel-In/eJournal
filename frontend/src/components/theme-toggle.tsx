"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const isTransitioningRef = React.useRef(false);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={`size-8 rounded-full bg-card/60 border border-border/60 ${className}`}
      >
        <span className="size-3.5" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isTransitioningRef.current) return;

    const nextTheme = isDark ? "light" : "dark";

    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { ready: Promise<void> };
    };

    // Fallback if View Transitions API is not supported or user prefers reduced motion
    if (
      !doc.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setTheme(nextTheme);
      return;
    }

    isTransitioningRef.current = true;

    // Geometric center of the toggle button as origin
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    // Euclidean radius to the furthest screen corner
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    try {
      const transition = doc.startViewTransition(() => {
        flushSync(() => {
          setTheme(nextTheme);
        });
      });

      transition.ready.then(() => {
        doc.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 650,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      });

      transition.finished
        .catch(() => {})
        .finally(() => {
          isTransitioningRef.current = false;
        });
    } catch {
      setTheme(nextTheme);
      isTransitioningRef.current = false;
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      data-tooltip={isDark ? "Switch to Day Mode" : "Switch to Night Mode"}
      data-tooltip-subtext={isDark ? "Click for Day Mode" : "Click for Night Mode"}
      data-tooltip-side="bottom"
      className={`size-8 rounded-full ${
        isDark ? "glass-btn-cyan" : "glass-btn-amber"
      } hover:scale-105 active:scale-95 transition-all cursor-pointer ${className}`}
    >
      {isDark ? (
        <Moon className="size-3.5 text-sky-400 transition-all" />
      ) : (
        <Sun className="size-3.5 text-amber-500 transition-all" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

