"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { useStaffMutations } from "@/src/features/dashboard/staff/hooks/staff.hooks";
import { RequireRole } from "@/src/components/auth/RequireRole";
import { DashboardHero, DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";

export default function InviteStaffPage() {
  const router = useRouter();
  const { invite, isLoading, error } = useStaffMutations();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await invite({ full_name: fullName.trim(), email: email.trim(), role: "staff" });
      router.replace("/dashboard/staff?success=Invitation%20sent");
    } catch {
      // error is surfaced below
    }
  }

  return (
    <RequireRole>
    <DashboardPageShell className="max-w-3xl">
      <DashboardHero
        eyebrow="Staff management"
        title="Invite a staff member"
        description="Create an internal account and send an invitation email to start working in the school workspace."
      />

      <DashboardPanel>
        <form onSubmit={handleSubmit} className="grid gap-4">
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
          <div className="rounded-xl border border-border/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            New staff invites default to the staff role.
          </div>

          {error ? (
            <div className="flex items-center gap-2 text-sm text-error">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send invitation
            </Button>
            <Link href="/dashboard/staff" className="text-sm font-medium text-primary underline underline-offset-4">
              Back to staff list
            </Link>
          </div>
        </form>
      </DashboardPanel>
    </DashboardPageShell>
    </RequireRole>
  );
}
