"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { useStaffMutations } from "@/src/features/dashboard/staff/hooks/staff.hooks";

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
    <main className="min-h-screen bg-background px-6 py-8 md:px-10 lg:px-16">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <p className="font-label text-xs uppercase tracking-[0.25em] text-primary">Staff management</p>
          <h1 className="mt-2 font-headline text-3xl text-on-surface">Edit staff member</h1>
          <p className="mt-3 text-sm text-on-surface-variant">Update the staff member’s name and email address.</p>
        </header>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <div className="grid gap-4">
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
              Save changes
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
