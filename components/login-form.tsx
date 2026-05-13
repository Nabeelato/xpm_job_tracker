"use client";

import { useState, useTransition } from "react";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setError("");
        startTransition(async () => {
          const result = await signIn("credentials", {
            email: formData.get("email"),
            password: formData.get("password"),
            redirect: false,
          });

          if (result?.error) {
            setError("Invalid email, password, or inactive account.");
            return;
          }

          router.push(searchParams.get("callbackUrl") || "/dashboard");
          router.refresh();
        });
      }}
    >
      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300" htmlFor="email">
          Email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            autoComplete="email"
            className="h-10 rounded-2xl border-white/10 bg-white/5 pl-11 pr-4 text-[13px] text-white shadow-none placeholder:text-slate-500"
            id="email"
            name="email"
            placeholder="name@company.com"
            required
            type="email"
          />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300" htmlFor="password">
            Password
          </label>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">Private access</span>
        </div>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            autoComplete="current-password"
            className="h-10 rounded-2xl border-white/10 bg-white/5 pl-11 pr-4 text-[13px] text-white shadow-none placeholder:text-slate-500"
            id="password"
            name="password"
            placeholder="Enter your password"
            required
            type="password"
          />
        </div>
      </div>
      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[11px] text-red-200 sm:text-xs" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        className="h-10 w-full rounded-2xl bg-primary text-[13px] font-semibold text-primary-foreground shadow-[0_20px_40px_-24px_hsla(var(--primary),0.95)] hover:bg-primary/90"
        disabled={pending}
        type="submit"
      >
        <span>{pending ? "Signing in..." : "Sign in to workspace"}</span>
        <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}
