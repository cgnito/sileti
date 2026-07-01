"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { useStaffMutations } from "@/src/features/dashboard/staff/hooks/staff.hooks";
import { DashboardHero, DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";

export default function EditStaffPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { update, isLoading, error } = useStaffMutations();

  const initialName = useMemo(() => searchParams.get("full_name") ?? "", [searchParams]);
  const initialEmail = useMemo(() => searchParams.get("email") ?? "", [searchParams]);

  const [fullName, setFullName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!params.id) return;

    try {
      await update(params.id, { full_name: fullName.trim(), email: email.trim() });
      router.replace("/dashboard/staff?success=Staff%20updated");
    } catch {
      // error displayed below
    }
  }

  return (
    <DashboardPageShell className="max-w-3xl">
      <DashboardHero
        eyebrow="Staff management"
        title="Edit staff member"
        description="Update the staff member’s name and email address."
      />

      <DashboardPanel>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="space-y-2 text-sm text-on-surface-variant">
            <span className="block font-medium">Full name</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
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
              required
            />
          </label>

          {error ? (
            <div className="flex items-center gap-2 text-sm text-error">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
            <Link href="/dashboard/staff" className="text-sm font-medium text-primary underline underline-offset-4">
              Back to staff list
            </Link>
          </div>
        </form>
      </DashboardPanel>
    </DashboardPageShell>
  );
}
