/**
 * OTP Verification view.
 *
 * Checks user email parameters and verifies ownership via 6-digit box controls.
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
    mutationFn: (data: VerifyFields) => api.post("/auth/verify-otp", data),
    onSuccess: () => {
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
      setSuccessMsg("A new verification code has been sent!");
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
    <div className="w-full max-w-[400px] p-8 rounded-2xl border border-border bg-card shadow-sm flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col items-center gap-1 text-center">
        <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl shadow-sm mb-2">
          eJ
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Verify Account</h2>
        <p className="text-sm text-muted-foreground">
          We sent a verification code to <span className="font-semibold text-foreground">{emailParam}</span>
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium border border-emerald-500/20">
            {successMsg}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground text-center mb-1">
            Enter 6-Digit OTP Code
          </label>
          <input
            type="text"
            placeholder="123456"
            maxLength={6}
            className="h-12 text-center text-xl font-bold tracking-[6px] rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            {...register("otp")}
          />
          {errors.otp && (
            <span className="text-xs text-destructive text-center mt-1">{errors.otp.message}</span>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full mt-2" disabled={verifyMutation.isPending}>
          {verifyMutation.isPending ? "Verifying..." : "Verify & Log In"}
        </Button>
      </form>

      {/* Resend button */}
      <div className="text-center text-sm text-muted-foreground">
        Didn&apos;t receive code?{" "}
        <button
          type="button"
          onClick={() => resendMutation.mutate()}
          disabled={resendMutation.isPending}
          className="font-semibold text-primary hover:underline bg-transparent border-0 p-0 cursor-pointer disabled:opacity-50"
        >
          {resendMutation.isPending ? "Resending..." : "Resend Code"}
        </button>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
      <Suspense fallback={<div>Loading verification...</div>}>
        <VerifyContent />
      </Suspense>
    </div>
  );
}
