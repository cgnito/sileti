"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Save } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { apiClient } from "@/src/shared/api-client";
import { fetchMySchool } from "@/src/features/auth/api/auth.api";
import { useAuthStore } from "@/src/features/auth/store/useAuthStore";
import { RequireRole } from "@/src/components/auth/RequireRole";
import { DashboardHero, DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";

type SchoolProfile = {
  id: string;
  schoolName: string;
  shortCode: string;
  schoolEmail: string;
  slug: string | null;
};

export default function SchoolProfilePage() {
  const org = useAuthStore((state) => state.org);
  const [schoolName, setSchoolName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setIsLoading(true);
      setError(null);
      try {
        const source = org ?? await fetchMySchool();
        if (active) {
          setSchoolName(source.schoolName);
          setShortCode(source.shortCode);
          setSchoolEmail(source.schoolEmail);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "We could not load your school profile.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [org]);

  async function handleSave() {
    if (!schoolName.trim() || !shortCode.trim() || !schoolEmail.trim()) {
      setError("Complete all fields before saving.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiClient.patch<SchoolProfile>("/orgs/my-school", {
        school_name: schoolName.trim(),
        short_code: shortCode.trim(),
        school_email: schoolEmail.trim(),
      });
      await fetchMySchool();
      setSuccess("School profile updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not update your school profile.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <RequireRole>
    <DashboardPageShell className="max-w-5xl">
      <DashboardHero
        eyebrow="Setup"
        title="School profile"
        description="Keep your school identity details in sync across login, setup, and billing."
        action={(
          <Link href="/dashboard/setup" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4">
            <ChevronLeft className="h-4 w-4" />
            Back to setup
          </Link>
        )}
      />

      <DashboardPanel className="grid gap-6">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl border border-border/70 bg-surface-container-low" />)}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-on-surface-variant md:col-span-2">
                <span className="block font-medium text-on-surface">School name</span>
                <input
                  value={schoolName}
                  onChange={(event) => setSchoolName(event.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Greenwood Academy"
                />
              </label>
              <label className="space-y-2 text-sm text-on-surface-variant">
                <span className="block font-medium text-on-surface">Short code</span>
                <input
                  value={shortCode}
                  onChange={(event) => setShortCode(event.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="KWA"
                />
              </label>
              <label className="space-y-2 text-sm text-on-surface-variant">
                <span className="block font-medium text-on-surface">Login email</span>
                <input
                  type="email"
                  value={schoolEmail}
                  disabled
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="admin@example.com"
                />
                <p className="text-xs text-on-surface-variant">This email is tied to the school admin login and cannot be edited here.</p>
              </label>
            </div>

            <div className="rounded-[1.15rem] border border-border/70 bg-surface-container-low px-4 py-4 text-sm text-on-surface-variant">
              <p className="font-semibold text-on-surface">Tip</p>
              <p className="mt-1 leading-6">The school email is locked because it is the admin login identifier.</p>
            </div>

            {error ? <p className="text-xs text-error">{error}</p> : null}
            {success ? <p className="text-xs text-primary">{success}</p> : null}

            <div className="flex justify-start">
              <Button onClick={() => void handleSave()} disabled={isSaving}>
                <Save className="h-4 w-4" />
                {isSaving ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </>
        )}
      </DashboardPanel>
    </DashboardPageShell>
    </RequireRole>
  );
}
