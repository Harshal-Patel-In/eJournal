/**
 * Login view.
 *
 * Grounded in Apple HIG and eJournal DESIGN.md.
 * Minimalist container card, custom fields with validation.
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
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      {/* Subtle ambient light glow underneath floating glass card */}
      <div className="absolute size-[450px] rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[400px] p-8 rounded-3xl bg-gradient-to-b from-white/80 via-white/65 to-white/50 dark:from-zinc-900/85 dark:via-zinc-900/75 dark:to-zinc-950/70 backdrop-blur-2xl backdrop-saturate-180 border border-white/80 dark:border-white/15 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.1),_inset_0_1px_1px_0_rgba(255,255,255,0.95),_inset_0_-1px_1px_0_rgba(0,0,0,0.05)] dark:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7),_inset_0_1px_1px_0_rgba(255,255,255,0.18),_inset_0_-1px_1px_0_rgba(0,0,0,0.5)] flex flex-col gap-6 relative transition-all duration-300">
        {/* Header */}
        <div className="flex flex-col items-center gap-1 text-center">
          <img
            src="/logo.png"
            alt="eJournal Logo"
            className="h-16 w-auto object-contain mb-2"
          />
          <h2 className="text-2xl font-bold tracking-tight">Sign In</h2>
          <p className="text-sm text-muted-foreground">
            Access your academic reviews & journals
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Institutional Email
            </label>
            <input
              type="email"
              placeholder="email@university.edu"
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              {...register("email")}
            />
            {errors.email && (
              <span className="text-xs text-destructive mt-0.5">{errors.email.message}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-muted-foreground">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(true)}
                className="text-xs font-semibold text-primary hover:underline bg-transparent border-0 p-0 cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <input
              type="password"
              placeholder="••••••••"
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              {...register("password")}
            />
            {errors.password && (
              <span className="text-xs text-destructive mt-0.5">{errors.password.message}</span>
            )}
          </div>

          <Button type="submit" size="lg" className="w-full mt-2" disabled={mutation.isPending}>
            {mutation.isPending ? "Signing In..." : "Sign In"}
          </Button>
        </form>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground mt-2">
          New to eJournal?{" "}
          <Link href="/auth/register" className="font-semibold text-primary hover:underline">
            Register Account
          </Link>
        </div>
      </div>

      {/* Custom Institutional Password Reset Security Modal */}
      {showForgotPasswordModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-password-title"
          className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowForgotPasswordModal(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-white/95 via-white/90 to-white/85 dark:from-zinc-900/95 dark:via-zinc-900/90 dark:to-zinc-950/90 backdrop-blur-2xl backdrop-saturate-180 border border-white/80 dark:border-white/15 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2),_inset_0_1px_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),_inset_0_1px_1px_0_rgba(255,255,255,0.18)] p-6 sm:p-7 space-y-6 animate-in zoom-in-95 duration-200 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowForgotPasswordModal(false)}
              className="absolute top-5 right-5 p-2 rounded-2xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all duration-150 cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </button>

            {/* Header: Shield + Titles */}
            <div className="flex items-start gap-4 pr-8">
              <div className="size-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-[0_2px_12px_rgba(245,158,11,0.15)]">
                <ShieldAlert className="size-6" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  CHARUSAT Security Protocol
                </div>
                <h3 id="forgot-password-title" className="text-lg font-bold text-foreground tracking-tight">
                  Institutional Password Recovery
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Automated self-service resets are restricted to protect university academic records and evaluations.
                </p>
              </div>
            </div>

            {/* Recovery Pathway Rows */}
            <div className="space-y-2.5">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 hover:border-black/10 dark:hover:border-white/15 transition-colors">
                <div className="size-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <GraduationCap className="size-4" />
                </div>
                <div className="text-xs space-y-0.5">
                  <span className="font-bold text-foreground block">Enrolled Students</span>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    Contact your <strong className="text-foreground font-semibold">Class Counselor</strong> or <strong className="text-foreground font-semibold">Department Coordinator</strong> at your constituent institute (CSPIT, DEPSTAR, PDPIAS, RPCP, CMPICA, ARIP, MTIN, CIPS, I2IM) with your University Enrollment Number.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 hover:border-black/10 dark:hover:border-white/15 transition-colors">
                <div className="size-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 className="size-4" />
                </div>
                <div className="text-xs space-y-0.5">
                  <span className="font-bold text-foreground block">Faculty & Instructors</span>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    Reach out to your <strong className="text-foreground font-semibold">Head of Department (HOD)</strong> or the <strong className="text-foreground font-semibold">Campus System Administrator</strong> for identity re-authorization.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06] border border-emerald-500/20">
                <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <KeyRound className="size-4" />
                </div>
                <div className="text-xs space-y-0.5">
                  <span className="font-bold text-foreground block">Instant Verification & Issuance</span>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    Upon administrative verification, a secure temporary login credential will be dispatched directly to your registered institutional email.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(false)}
                className="w-full h-11 rounded-2xl bg-gradient-to-b from-blue-500/15 via-blue-500/10 to-blue-600/15 hover:from-blue-500/25 hover:via-blue-500/20 hover:to-blue-600/25 dark:from-blue-500/25 dark:via-blue-500/20 dark:to-blue-600/30 dark:hover:from-blue-500/35 dark:hover:to-blue-600/40 text-blue-600 dark:text-blue-400 border border-blue-500/30 dark:border-blue-400/35 font-bold text-xs tracking-tight backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),_0_2px_10px_rgba(37,99,235,0.12)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_4px_16px_rgba(37,99,235,0.25)] hover:scale-[1.01] active:scale-[0.98] transition-all duration-150 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Understood</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
