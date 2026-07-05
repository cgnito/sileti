"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, MailPlus, PencilLine, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { useStaffList, useStaffMutations } from "@/src/features/dashboard/staff/hooks/staff.hooks";
import { DashboardEmptyState, DashboardHero, DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";
import { RequireRole } from "@/src/components/auth/RequireRole";

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
    <RequireRole>
    <DashboardPageShell>
      <DashboardHero
        eyebrow="Staff management"
        title="School team"
        description="Invite, update, and manage internal staff accounts for your school."
        action={(
          <Button href="/dashboard/staff/invite">
            <MailPlus className="h-4 w-4" />
            Invite staff
          </Button>
        )}
      />

      {feedback ? (
        <DashboardPanel className="border-primary/20 bg-primary/10">
          <p className="text-sm text-primary">{feedback}</p>
        </DashboardPanel>
      ) : null}

      <DashboardPanel>
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
          <DashboardEmptyState
            title="No staff yet"
            description="No staff have been added yet."
            action={(
              <Button href="/dashboard/staff/invite">
                <MailPlus className="h-4 w-4" />
                Invite staff
              </Button>
            )}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[1.6fr_1.4fr_0.7fr_0.7fr_0.9fr] bg-surface-container-low px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                <span>Name</span>
                <span>Email</span>
                <span>Role</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              <div className="divide-y divide-border/70 bg-white">
                {staff.map((member) => (
                  <div key={member.id} className="grid grid-cols-[1.6fr_1.4fr_0.7fr_0.7fr_0.9fr] items-center gap-2 px-4 py-4 transition-colors hover:bg-surface-container-low/50">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-on-surface">{member.full_name}</p>
                    </div>
                    <div className="min-w-0 text-sm text-on-surface-variant">
                      <span className="block truncate">{member.email}</span>
                    </div>
                    <div className="text-sm text-on-surface-variant">{member.role}</div>
                    <div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase ${member.is_active ? "bg-primary/10 text-primary" : "bg-secondary-container text-on-secondary-container"}`}>
                        {member.is_active ? "Active" : "Invited"}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        title="Edit staff member"
                        aria-label={`Edit ${member.full_name}`}
                        onClick={() => router.push(`/dashboard/staff/${member.id}/edit?full_name=${encodeURIComponent(member.full_name)}&email=${encodeURIComponent(member.email)}`)}
                        disabled={isMutating}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-surface-container-low text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                      >
                        <PencilLine className="h-4 w-4" />
                      </button>
                      {!member.is_active && (
                        <button
                          type="button"
                          title="Resend invitation"
                          aria-label={`Resend invitation to ${member.full_name}`}
                          onClick={() => void handleResend(member.id)}
                          disabled={isMutating}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-surface-container-low text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        title="Remove staff member"
                        aria-label={`Remove ${member.full_name}`}
                        onClick={() => void handleRemove(member.id, member.full_name)}
                        disabled={isMutating}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-surface-container-low text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DashboardPanel>
    </DashboardPageShell>
    </RequireRole>
  );
}

export default function StaffListPage() {
  return (
    <Suspense fallback={null}>
      <StaffListContent />
    </Suspense>
  );
}
