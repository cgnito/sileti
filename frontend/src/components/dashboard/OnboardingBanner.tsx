"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/src/features/auth/store/useAuthStore";
import { fetchOnboardingStatus } from "@/src/features/auth/api/auth.api";
import type { OnboardingProgress } from "@/src/features/auth/types/auth.types";

type OnboardingStep = {
  key: keyof OnboardingProgress["steps"];
  label: string;
  href: string;
};

const steps: OnboardingStep[] = [
  { key: "email_verified", label: "Email verified", href: "/verify-email" },
  { key: "bank_settlement", label: "Bank settlement", href: "/dashboard/setup/bank" },
  { key: "classes_created", label: "Classes created", href: "/dashboard/setup/classes" },
  { key: "students_added", label: "Students added", href: "/dashboard/setup/students" },
  { key: "fees_configured", label: "Fees configured", href: "/dashboard/setup/fees" },
];

export function OnboardingBanner() {
  const user = useAuthStore((s) => s.user);
  const onboardingProgress = useAuthStore((s) => s.onboardingProgress);
  const setOnboardingProgress = useAuthStore((s) => s.setOnboardingProgress);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!user) return;
      setIsLoading(true);
      setError(null);

      try {
        const progress = await fetchOnboardingStatus();
        if (active) {
          setOnboardingProgress(progress);
        }
      } catch {
        if (active) {
          setError("We could not refresh your setup progress right now.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [setOnboardingProgress, user]);

  const progress = useMemo(() => {
    if (!onboardingProgress) return null;

    const completedCount = steps.filter((step) => onboardingProgress.steps[step.key]).length;
    const totalCount = steps.length;
    return {
      completedCount,
      totalCount,
      percent: Math.round((completedCount / totalCount) * 100),
    };
  }, [onboardingProgress]);

  if (!user || onboardingProgress?.is_completed) return null;

  return (
    <section className="rounded-[1.35rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,252,247,0.95),rgba(250,245,237,0.92))] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-label uppercase tracking-[0.2em] text-primary">
            <AlertCircle className="h-3.5 w-3.5" />
            Complete setup
          </div>
          <div>
            <h2 className="font-headline text-xl text-on-surface">Finish your school setup</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {progress
                ? `You are ${progress.completedCount}/${progress.totalCount} steps away from a fully ready dashboard.`
                : "We are checking your setup progress now."}
            </p>
          </div>
        </div>

        {progress && (
          <div className="w-full max-w-sm">
            <div className="mb-2 flex items-center justify-between text-sm font-medium text-on-surface-variant">
              <span>Progress</span>
              <span>
                {progress.completedCount}/{progress.totalCount}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {steps.map((step) => {
          const isDone = Boolean(onboardingProgress?.steps[step.key]);

          return (
            <div
              key={step.key}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-surface-container-low px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-on-surface">{step.label}</span>
              </div>
              {!isDone && (
                <Link
                  href={step.href}
                  className="rounded-lg border border-primary/20 bg-white px-3 py-2 text-xs font-label uppercase tracking-[0.2em] text-primary transition-colors hover:bg-primary/10"
                >
                  Continue
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {isLoading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-on-surface-variant">
          <Loader2 className="h-4 w-4 animate-spin" />
          Updating your checklist…
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-error">{error}</p>
      )}
    </section>
  );
}
