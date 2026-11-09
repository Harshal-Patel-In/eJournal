/**
 * Register account view — Almanac Archival Monograph.
 *
 * Enforces role selection, institutional validation,
 * and clean paper monograph typography.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { useMutation } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const registerSchema = zod.object({
  email: zod.string().email("Enter a valid institutional email"),
  password: zod.string().min(8, "Password must be at least 8 characters"),
});

type RegisterFields = zod.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFields>({
    resolver: zodResolver(registerSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: RegisterFields) =>
      api.post("/auth/register", { ...data, role: "student" }),
    onSuccess: () => {
      // Redirect to verification screen with email preloaded
      router.push(`/auth/verify?email=${encodeURIComponent(watch("email"))}`);
    },
    onError: (error: any) => {
      setErrorMsg(error.message || "Registration failed. Email might already be taken.");
    },
  });

  const onSubmit = (data: RegisterFields) => {
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
          <h2 className="text-xl font-bold tracking-tight text-foreground font-serif">Student registration</h2>
          <p className="text-xs text-muted-foreground">
            Create your student journal account
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20">
              {errorMsg}
            </div>
          )}

          {/* Institutional Student Notice */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border/80 text-xs text-muted-foreground flex items-start gap-2 leading-relaxed">
            <span className="font-semibold text-foreground shrink-0">Note:</span>
            <span>
              Self-registration is designated for students. Faculty accounts are provisioned exclusively by Institutional Administrators.
            </span>
          </div>

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
            <label className="text-xs font-medium text-muted-foreground">
              Password
            </label>
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
            {mutation.isPending ? "Creating account..." : "Create account"}
          </Button>
        </form>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-1 border-t border-border/60">
          Already registered?{" "}
          <Link href="/auth/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
