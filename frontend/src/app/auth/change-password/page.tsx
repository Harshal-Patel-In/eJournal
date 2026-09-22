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
    <div className="flex min-h-screen items-center justify-center bg-slate-100/70 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-md rounded-3xl border border-border/70 bg-card/90 dark:bg-zinc-900/90 backdrop-blur-2xl p-8 shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="size-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shadow-xs">
            <KeyRound className="size-6" />
          </div>
          <h1 className="text-xl font-black text-foreground tracking-tight">Set Your Password</h1>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
            For institutional security compliance, your account requires setting a private, strong password before accessing the platform.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Current / Temporary Password</label>
            <input
              type="password"
              {...register("current_password")}
              placeholder="Enter current or temporary password"
              className="w-full rounded-xl border border-border/80 bg-background/80 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {errors.current_password && (
              <p className="text-[11px] text-destructive font-medium">{errors.current_password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">New Permanent Password</label>
            <input
              type="password"
              {...register("new_password")}
              placeholder="At least 8 characters (mixed case + number)"
              className="w-full rounded-xl border border-border/80 bg-background/80 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {errors.new_password && (
              <p className="text-[11px] text-destructive font-medium">{errors.new_password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Confirm New Password</label>
            <input
              type="password"
              {...register("confirm_password")}
              placeholder="Re-enter your new password"
              className="w-full rounded-xl border border-border/80 bg-background/80 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {errors.confirm_password && (
              <p className="text-[11px] text-destructive font-medium">{errors.confirm_password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-xl text-xs font-bold py-2.5 cursor-pointer shadow-md"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Updating Security Credentials...
              </>
            ) : (
              <>
                <ShieldCheck className="size-4 mr-2" />
                Update Password & Proceed
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
