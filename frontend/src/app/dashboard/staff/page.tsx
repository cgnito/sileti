"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, MailPlus, UserMinus, UserRoundPen } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { useStaffList, useStaffMutations } from "@/src/features/dashboard/staff/hooks/staff.hooks";

function StaffListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { staff, isLoading, error, load } = useStaffList();
  const { remove, resend, isLoading: isMutating, error: actionError } = useStaffMutations();
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const successMessage = useMemo(() => searchParams.get("success") ?? null, [searchParams]);

  useEffect(() => {
    if (successMessage) {
      setFeedback(successMessage);
    }
  }, [successMessage]);

  async function handleResend(userId: string) {
    try {
      const result = await resend(userId);
      setFeedback(result.message);
      await load();
    } catch {
      setFeedback(actionError ?? "We could not resend that invite.");
    }
  }

  async function handleRemove(userId: string, fullName: string) {
    if (!window.confirm(`Remove ${fullName} from this school team?`)) return;
    try {
      const result = await remove(userId);
      setFeedback(result.message);
      await load();
    } catch {
      setFeedback(actionError ?? "We could not remove that staff member.");
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8 md:px-10 lg:px-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="font-label text-xs uppercase tracking-[0.25em] text-primary">Staff management</p>
              <h1 className="mt-2 font-headline text-3xl text-on-surface">School team</h1>
              <p className="mt-3 text-sm text-on-surface-variant">Invite, update, and manage internal staff accounts for your school.</p>
            </div>
            <Button href="/dashboard/staff/invite">
              <MailPlus className="h-4 w-4" />
              Invite staff
            </Button>
          </div>
        </header>

        {feedback && (
          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
            {feedback}
          </div>
        )}

        <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading staff members…
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-error">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : staff.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
              No staff have been added yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/70">
              <div className="grid grid-cols-[1.6fr_1.4fr_0.7fr_0.7fr_1fr] bg-surface-container-low px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                <span>Name</span>
                <span>Email</span>
                <span>Role</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              <div className="divide-y divide-border/70 bg-white">
                {staff.map((member) => (
                  <div key={member.id} className="grid grid-cols-[1.6fr_1.4fr_0.7fr_0.7fr_1fr] items-center gap-2 px-4 py-4">
                    <div>
                      <p className="font-semibold text-on-surface">{member.full_name}</p>
                    </div>
                    <div className="text-sm text-on-surface-variant">{member.email}</div>
                    <div className="text-sm text-on-surface-variant">{member.role}</div>
                    <div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${member.is_active ? "bg-primary/10 text-primary" : "bg-secondary-container text-on-secondary-container"}`}>
                        {member.is_active ? "Active" : "Invited"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => router.push(`/dashboard/staff/${member.id}/edit?full_name=${encodeURIComponent(member.full_name)}&email=${encodeURIComponent(member.email)}`)}
                        disabled={isMutating}
                      >
                        <UserRoundPen className="h-4 w-4" />
                        Edit
                      </Button>
                      {!member.is_active && (
                        <Button variant="secondary" size="md" onClick={() => void handleResend(member.id)} disabled={isMutating}>
                          Resend invite
                        </Button>
                      )}
                      <Button variant="secondary" size="md" onClick={() => void handleRemove(member.id, member.full_name)} disabled={isMutating}>
                        <UserMinus className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function StaffListPage() {
  return (
    <Suspense fallback={null}>
      <StaffListContent />
    </Suspense>
  );
}
