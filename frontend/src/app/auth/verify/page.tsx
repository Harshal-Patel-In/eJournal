/**
 * OTP Verification view — Almanac Archival Monograph.
 *
 * Verifies account ownership via 6-digit code with tabular monospace figures.
 */

"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { useMutation } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const verifySchema = zod.object({
  email: zod.string().email(),
  otp: zod.string().length(6, "Enter the complete 6-digit OTP code"),
});

type VerifyFields = zod.infer<typeof verifySchema>;

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<VerifyFields>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      email: emailParam,
    },
  });

  useEffect(() => {
    if (emailParam) {
      setValue("email", emailParam);
    }
  }, [emailParam, setValue]);

  // Verify OTP mutation
  const verifyMutation = useMutation({
    mutationFn: (data: VerifyFields) => api.post<{ access_token: string }>("/auth/verify-otp", data),
    onSuccess: (data) => {
      if (typeof window !== "undefined" && data?.access_token) {
        const isSecure = window.location.protocol === "https:";
        document.cookie = `access_token=${data.access_token}; path=/; max-age=1800; SameSite=Lax${isSecure ? "; Secure" : ""}`;
      }
      setSuccessMsg("Account successfully verified! Redirecting to setup...");
      setTimeout(() => {
        router.push("/profile/setup");
        router.refresh();
      }, 1500);
    },
    onError: (error: any) => {
      setErrorMsg(error.message || "Invalid or expired verification code");
    },
  });

  // Resend OTP mutation
  const resendMutation = useMutation({
    mutationFn: () => api.post("/auth/resend-otp", { email: emailParam }),
    onSuccess: () => {
      setSuccessMsg("A new verification code has been dispatched to your email.");
      setErrorMsg(null);
    },
    onError: (error: any) => {
      setErrorMsg(error.message || "Failed to resend code");
    },
  });

  const onSubmit = (data: VerifyFields) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    verifyMutation.mutate(data);
  };

  return (
    <div className="w-full max-w-[400px] p-6 sm:p-8 rounded-2xl bg-card text-card-foreground border border-border/80 shadow-lg flex flex-col gap-5 relative select-none">
      {/* Header */}
      <div className="flex flex-col items-center gap-1.5 text-center">
        <img
          src="/logo.png"
          alt="eJournal Logo"
          className="h-12 w-auto object-contain mb-1"
        />
        <h2 className="text-xl font-bold tracking-tight text-foreground font-serif">Verify account</h2>
        <p className="text-xs text-muted-foreground">
          We sent a verification code to{" "}
          <span className="font-semibold text-foreground">{emailParam || "your email"}</span>
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-500/20">
            {successMsg}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground text-center">
            Enter 6-digit verification code
          </label>
          <input
            type="text"
            placeholder="123456"
            maxLength={6}
            className="h-12 text-center text-xl font-mono font-bold tracking-[8px] rounded-xl border border-input bg-muted/40 focus:bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all disabled:cursor-not-allowed disabled:opacity-50"
            {...register("otp")}
          />
          {errors.otp && (
            <span className="text-xs text-destructive text-center mt-1">{errors.otp.message}</span>
          )}
        </div>

        <Button
          type="submit"
          size="default"
          className="w-full mt-2 h-10 rounded-xl font-semibold text-xs glass-btn-indigo-solid active:scale-[0.98] transition-all cursor-pointer shadow-xs"
          disabled={verifyMutation.isPending}
        >
          {verifyMutation.isPending ? "Verifying..." : "Verify & proceed"}
        </Button>
      </form>

      {/* Resend button */}
      <div className="text-center text-xs text-muted-foreground pt-1 border-t border-border/60">
        Didn&apos;t receive code?{" "}
        <button
          type="button"
          onClick={() => resendMutation.mutate()}
          disabled={resendMutation.isPending}
          className="font-semibold text-primary hover:underline bg-transparent border-0 p-0 cursor-pointer disabled:opacity-50"
        >
          {resendMutation.isPending ? "Resending..." : "Resend code"}
        </button>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-background select-none">
      <Suspense fallback={<div className="text-xs text-muted-foreground">Loading verification...</div>}>
        <VerifyContent />
      </Suspense>
    </div>
  );
}
