"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { useStaffMutations } from "@/src/features/dashboard/staff/hooks/staff.hooks";

function SetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetPassword, isLoading, error } = useStaffMutations();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) {
      setFeedback("This password setup link is missing a token.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback("Passwords do not match.");
      return;
    }

    try {
      const result = await resetPassword({ token, new_password: newPassword });
      setFeedback(result.message);
      router.replace("/login?success=Password%20set");
    } catch {
      // error displayed below
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8 md:px-10 lg:px-16">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <p className="font-label text-xs uppercase tracking-[0.25em] text-primary">Account setup</p>
          <h1 className="mt-2 font-headline text-3xl text-on-surface">Set your password</h1>
          <p className="mt-3 text-sm text-on-surface-variant">Create a password to activate your staff account and sign in securely.</p>
        </header>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <div className="grid gap-4">
            <label className="space-y-2 text-sm text-on-surface-variant">
              <span className="block font-medium">New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                required
                minLength={8}
              />
            </label>
            <label className="space-y-2 text-sm text-on-surface-variant">
              <span className="block font-medium">Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                required
                minLength={8}
              />
            </label>
          </div>

          {feedback && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
              {feedback}
            </div>
          )}
          {error && (
            <div className="mt-4 flex items-center gap-2 text-sm text-error">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create password
            </Button>
            <Link href="/login" className="text-sm font-medium text-primary underline underline-offset-4">
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordContent />
    </Suspense>
  );
}
