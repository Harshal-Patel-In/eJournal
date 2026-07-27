"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

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

  const toggleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      title={
        theme === "dark"
          ? "Night Mode (Dark) — Click for System Theme"
          : theme === "light"
          ? "Light Mode — Click for Night Mode"
          : "System Theme — Click for Light Mode"
      }
      className={`size-8 rounded-full bg-card/75 dark:bg-card/60 backdrop-blur-xl border border-white/60 dark:border-white/20 ring-1 ring-black/5 dark:ring-white/10 shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer ${className}`}
    >
      {theme === "dark" ? (
        <Moon className="size-3.5 text-sky-400 transition-all" />
      ) : theme === "light" ? (
        <Sun className="size-3.5 text-amber-500 transition-all" />
      ) : (
        <Monitor className="size-3.5 text-muted-foreground transition-all" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
