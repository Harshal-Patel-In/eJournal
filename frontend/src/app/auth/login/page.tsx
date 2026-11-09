/**
 * Login view — Almanac Archival Monograph.
 *
 * Minimalist paper ground, high-contrast type hierarchy,
 * instant keyboard accessibility, and zero artificial blur.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, X, GraduationCap, Building2, KeyRound } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const loginSchema = zod.object({
  email: zod.string().email("Enter a valid institutional email"),
  password: zod.string().min(8, "Password must be at least 8 characters"),
});

type LoginFields = zod.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowForgotPasswordModal(false);
      }
    };
    if (showForgotPasswordModal) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showForgotPasswordModal]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: LoginFields) =>
      api.post<{
        access_token: string;
        user: { role: string; is_profile_complete: boolean; must_change_password?: boolean };
      }>("/auth/login", data),
    onSuccess: (data) => {
      // Store the access token on the frontend domain so Vercel's middleware recognizes it
      if (typeof window !== "undefined" && data?.access_token) {
        const isSecure = window.location.protocol === "https:";
        document.cookie = `access_token=${data.access_token}; path=/; max-age=1800; SameSite=Lax${isSecure ? "; Secure" : ""}`;
      }

      // Purge all stale cached queries from previous user sessions
      queryClient.clear();

      if (data.user.must_change_password) {
        router.push("/auth/change-password");
      } else if (data.user.is_profile_complete) {
        // Dedicated Super Admin goes directly to /admin
        // Faculty (even with admin access) and students are redirected FIRST to the Academic Workspace (/dashboard)
        if (data.user.role === "admin") {
          router.push("/admin");
        } else {
          router.push("/dashboard");
        }
      } else {
        router.push("/profile/setup");
      }
      router.refresh();
    },
    onError: (error: any) => {
      setErrorMsg(error.message || "Invalid email or password");
    },
  });

  const onSubmit = (data: LoginFields) => {
    setErrorMsg(null);
    mutation.mutate(data);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-background relative select-none">
      <div className="w-full max-w-[400px] p-6 sm:p-8 rounded-2xl bg-card text-card-foreground border border-border/80 shadow-lg flex flex-col gap-5 relative">
        {/* Header */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <img
            src="/logo.png"
            alt="eJournal Logo"
            className="h-12 w-auto object-contain mb-1"
          />
          <h2 className="text-xl font-bold tracking-tight text-foreground font-serif">Sign in</h2>
          <p className="text-xs text-muted-foreground">
            Access your academic reviews & lab journals
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Institutional email
            </label>
            <input
              type="email"
              placeholder="email@university.edu"
              className="h-10 rounded-xl border border-input bg-muted/40 focus:bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all disabled:cursor-not-allowed disabled:opacity-50"
              {...register("email")}
            />
            {errors.email && (
              <span className="text-xs text-destructive mt-0.5">{errors.email.message}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-muted-foreground">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(true)}
                className="text-xs font-medium text-primary hover:underline bg-transparent border-0 p-0 cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <input
              type="password"
              placeholder="••••••••"
              className="h-10 rounded-xl border border-input bg-muted/40 focus:bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all disabled:cursor-not-allowed disabled:opacity-50"
              {...register("password")}
            />
            {errors.password && (
              <span className="text-xs text-destructive mt-0.5">{errors.password.message}</span>
            )}
          </div>

          <Button
            type="submit"
            size="default"
            className="w-full mt-2 h-10 rounded-xl font-semibold text-xs glass-btn-indigo-solid active:scale-[0.98] transition-all cursor-pointer shadow-xs"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-1 border-t border-border/60">
          New to eJournal?{" "}
          <Link href="/auth/register" className="font-semibold text-primary hover:underline">
            Register account
          </Link>
        </div>
      </div>

      {/* Custom Institutional Password Reset Security Modal */}
      {showForgotPasswordModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-password-title"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowForgotPasswordModal(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl bg-card text-card-foreground border border-border p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowForgotPasswordModal(false)}
              className="absolute top-4 right-4 size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-border"
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </button>

            {/* Header: Shield + Titles */}
            <div className="flex items-start gap-3.5 pr-6">
              <div className="size-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="size-5" />
              </div>
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.2 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  Institutional security protocol
                </div>
                <h3 id="forgot-password-title" className="text-base font-semibold text-foreground tracking-tight">
                  Password recovery
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Automated self-service resets are restricted to protect university academic records and evaluations.
                </p>
              </div>
            </div>

            {/* Recovery Pathway Rows */}
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <GraduationCap className="size-3.5" />
                </div>
                <div className="text-xs space-y-0.5">
                  <span className="font-semibold text-foreground block">Enrolled students</span>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    Contact your <strong className="text-foreground font-semibold">Class Counselor</strong> or <strong className="text-foreground font-semibold">Department Coordinator</strong> at your constituent institute with your University Enrollment Number.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 className="size-3.5" />
                </div>
                <div className="text-xs space-y-0.5">
                  <span className="font-semibold text-foreground block">Faculty & instructors</span>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    Reach out to your <strong className="text-foreground font-semibold">Head of Department (HOD)</strong> or the <strong className="text-foreground font-semibold">Campus System Administrator</strong> for identity re-authorization.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="size-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <KeyRound className="size-3.5" />
                </div>
                <div className="text-xs space-y-0.5">
                  <span className="font-semibold text-foreground block">Instant verification & issuance</span>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    Upon administrative verification, a secure temporary login credential will be dispatched directly to your registered institutional email.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-1">
              <Button
                onClick={() => setShowForgotPasswordModal(false)}
                className="w-full h-9 rounded-xl text-xs font-semibold glass-btn-frosted active:scale-[0.98] cursor-pointer shadow-xs"
              >
                Understood
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
