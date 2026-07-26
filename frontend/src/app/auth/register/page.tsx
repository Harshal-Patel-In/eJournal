/**
 * Register account view.
 *
 * Enforces role selection and validation.
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
  role: zod.enum(["student", "teacher"]),
});

type RegisterFields = zod.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterFields>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "student",
    },
  });

  const activeRole = watch("role");

  const mutation = useMutation({
    mutationFn: (data: RegisterFields) => api.post("/auth/register", data),
    onSuccess: (data: any) => {
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
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-[400px] p-8 rounded-2xl border border-border bg-card shadow-sm flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl shadow-sm mb-2">
            eJ
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Create Account</h2>
          <p className="text-sm text-muted-foreground">
            Get started with eJournal
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20">
              {errorMsg}
            </div>
          )}

          {/* Role Segmented control (Apple HIG style) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Select Your Role
            </label>
            <div className="flex p-1 bg-secondary rounded-lg border border-border">
              <button
                type="button"
                className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all ${
                  activeRole === "student"
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-primary"
                }`}
                onClick={() => setValue("role", "student")}
              >
                Student
              </button>
              <button
                type="button"
                className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all ${
                  activeRole === "teacher"
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-primary"
                }`}
                onClick={() => setValue("role", "teacher")}
              >
                Teacher
              </button>
            </div>
          </div>

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
            <label className="text-xs font-semibold text-muted-foreground">
              Password
            </label>
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
            {mutation.isPending ? "Creating Account..." : "Register"}
          </Button>
        </form>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground mt-2">
          Already registered?{" "}
          <Link href="/auth/login" className="font-semibold text-primary hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
