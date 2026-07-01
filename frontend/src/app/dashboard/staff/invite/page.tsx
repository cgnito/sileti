"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { useStaffMutations } from "@/src/features/dashboard/staff/hooks/staff.hooks";

const roleOptions = ["staff", "bursar"];

export default function InviteStaffPage() {
  const router = useRouter();
  const { invite, isLoading, error } = useStaffMutations();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roleOptions[0]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await invite({ full_name: fullName.trim(), email: email.trim(), role });
      router.replace("/dashboard/staff?success=Invitation%20sent");
    } catch {
      // error is surfaced below
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8 md:px-10 lg:px-16">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <p className="font-label text-xs uppercase tracking-[0.25em] text-primary">Staff management</p>
          <h1 className="mt-2 font-headline text-3xl text-on-surface">Invite a staff member</h1>
          <p className="mt-3 text-sm text-on-surface-variant">Create an internal account and send an invitation email to start working in the school workspace.</p>
        </header>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <div className="grid gap-4">
            <label className="space-y-2 text-sm text-on-surface-variant">
              <span className="block font-medium">Full name</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                placeholder="Ada Okafor"
                required
              />
            </label>
            <label className="space-y-2 text-sm text-on-surface-variant">
              <span className="block font-medium">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                placeholder="ada@school.edu.ng"
                required
              />
            </label>
            <label className="space-y-2 text-sm text-on-surface-variant">
              <span className="block font-medium">Role</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
              >
                {roleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-sm text-error">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send invitation
            </Button>
            <Link href="/dashboard/staff" className="text-sm font-medium text-primary underline underline-offset-4">
              Back to staff list
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
