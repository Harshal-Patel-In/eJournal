/**
 * Login view.
 *
 * Grounded in Apple HIG and eJournal DESIGN.md.
 * Minimalist container card, custom fields with validation.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: LoginFields) => api.post<{ access_token: string; user: { is_profile_complete: boolean } }>("/auth/login", data),
    onSuccess: (data) => {
      // Store the access token on the frontend domain so Vercel's middleware recognizes it
      if (typeof window !== "undefined" && data?.access_token) {
        const isSecure = window.location.protocol === "https:";
        document.cookie = `access_token=${data.access_token}; path=/; max-age=1800; SameSite=Lax${isSecure ? "; Secure" : ""}`;
      }

      // Purge all stale cached queries from previous user sessions
      queryClient.clear();

      if (data.user.is_profile_complete) {
        router.push("/dashboard");
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
                onClick={() =>
                  alert(
                    "For security reasons on the PDPIS institutional platform, please contact your department coordinator to request a password reset."
                  )
                }
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
    </div>
  );
}
