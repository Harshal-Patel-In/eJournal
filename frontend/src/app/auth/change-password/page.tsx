/**
 * Mandatory Password Rotation view — Almanac Archival Monograph.
 *
 * Enforces institutional security protocol for initial logins
 * with clean validation and high-contrast paper card styling.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, KeyRound, Loader2, AlertCircle } from "lucide-react";

import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

const changePasswordSchema = zod
  .object({
    current_password: zod.string().min(1, "Current password is required"),
    new_password: zod
      .string()
      .min(8, "New password must be at least 8 characters")
      .regex(/[A-Z]/, "Must include at least one uppercase letter")
      .regex(/[a-z]/, "Must include at least one lowercase letter")
      .regex(/[0-9]/, "Must include at least one digit"),
    confirm_password: zod.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type ChangePasswordFields = zod.infer<typeof changePasswordSchema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch current user profile to determine target redirect
  const { data: user } = useQuery<any>({
    queryKey: ["profile"],
    queryFn: () => api.get("/profile"),
    retry: false,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordFields>({
    resolver: zodResolver(changePasswordSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: ChangePasswordFields) =>
      api.post<{ access_token: string; message: string }>("/auth/change-password", {
        current_password: data.current_password,
        new_password: data.new_password,
      }),
    onSuccess: (res) => {
      if (typeof window !== "undefined" && res?.access_token) {
        const isSecure = window.location.protocol === "https:";
        document.cookie = `access_token=${res.access_token}; path=/; max-age=1800; SameSite=Lax${
          isSecure ? "; Secure" : ""
        }`;
      }
      queryClient.clear();
      toast.success("Password updated successfully! Welcome.", { title: "Security Verified" });

      if (user?.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to update password. Please verify current password.");
    },
  });

  const onSubmit = (data: ChangePasswordFields) => {
    setErrorMsg(null);
    mutation.mutate(data);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6 select-none">
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card text-card-foreground p-6 sm:p-8 shadow-lg space-y-5">
        <div className="flex flex-col items-center text-center space-y-1.5">
          <div className="size-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <KeyRound className="size-4" />
          </div>
          <h1 className="text-lg font-bold text-foreground tracking-tight font-serif">Set your permanent password</h1>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
            Your account requires establishing a secure personal password before proceeding to the academic workspace.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Current / temporary password</label>
            <input
              type="password"
              {...register("current_password")}
              placeholder="Enter temporary password from issuance"
              className="w-full h-10 rounded-xl border border-input bg-muted/40 focus:bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
            />
            {errors.current_password && (
              <p className="text-[11px] text-destructive mt-0.5">{errors.current_password.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">New permanent password</label>
            <input
              type="password"
              {...register("new_password")}
              placeholder="At least 8 characters (mixed case + number)"
              className="w-full h-10 rounded-xl border border-input bg-muted/40 focus:bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
            />
            {errors.new_password && (
              <p className="text-[11px] text-destructive mt-0.5">{errors.new_password.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Confirm new password</label>
            <input
              type="password"
              {...register("confirm_password")}
              placeholder="Re-enter your new password"
              className="w-full h-10 rounded-xl border border-input bg-muted/40 focus:bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
            />
            {errors.confirm_password && (
              <p className="text-[11px] text-destructive mt-0.5">{errors.confirm_password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            size="default"
            disabled={mutation.isPending}
            className="w-full mt-2 h-10 rounded-xl font-semibold text-xs glass-btn-indigo-solid active:scale-[0.98] transition-all cursor-pointer shadow-xs"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
                Updating credentials...
              </>
            ) : (
              <>
                <ShieldCheck className="size-3.5 mr-1.5" />
                Update password & proceed
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
