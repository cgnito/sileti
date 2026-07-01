"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, FileText, Landmark, Users, Wallet } from "lucide-react";
import { apiClient } from "@/src/shared/api-client";
import { fetchOnboardingStatus } from "@/src/features/auth/api/auth.api";
import { useAuthStore } from "@/src/features/auth/store/useAuthStore";
import { DashboardHero, DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";

type OnboardingStatus = {
  is_completed: boolean;
  steps: {
    email_verified: boolean;
    bank_settlement: boolean;
    classes_created: boolean;
    students_added: boolean;
    fees_configured: boolean;
  };
};

type DashboardStats = {
  students_count: number;
  classes_count: number;
  total_invoices: number;
  unpaid_invoices: number;
};

const statCards = [
  { label: "Students", icon: Users, key: "students_count" },
  { label: "Classes", icon: FileText, key: "classes_count" },
  { label: "Invoices", icon: Wallet, key: "total_invoices" },
  { label: "Unpaid", icon: Landmark, key: "unpaid_invoices" },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const isAdmin = user?.role === "admin";
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHydrating && !user) {
      router.replace("/login");
    }
  }, [isHydrating, router, user]);

  useEffect(() => {
    if (!user) return;
    let active = true;

    async function loadDashboard() {
      setIsLoading(true);
      setError(null);
      setOnboarding(null);
      setStats(null);

      try {
        const metricsPromise = apiClient.get<DashboardStats>("/billing/dashboard-metrics");
        const onboardingPromise = isAdmin ? fetchOnboardingStatus() : Promise.resolve(null);

        const [onboardingResult, metricsResult] = await Promise.allSettled([onboardingPromise, metricsPromise]);

        if (!active) return;

        if (onboardingResult.status === "fulfilled" && onboardingResult.value) {
          setOnboarding(onboardingResult.value);
        }

        if (metricsResult.status === "fulfilled") {
          setStats(metricsResult.value);
        }

        if (isAdmin && onboardingResult.status === "rejected") {
          setError(onboardingResult.reason instanceof Error ? onboardingResult.reason.message : "We could not load your dashboard.");
        } else if (metricsResult.status === "rejected") {
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "We could not load your dashboard.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [isAdmin, user]);

  const completedSteps = useMemo(() => {
    if (!onboarding) return 0;
    const steps = Object.values(onboarding.steps);
    return steps.filter(Boolean).length;
  }, [onboarding]);

  if (!user) return null;

  const greeting = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date());

  return (
    <DashboardPageShell>
      <DashboardHero
        eyebrow="Overview"
        title={`Good morning, ${user.displayName}`}
        description={greeting}
      />

      {isAdmin && onboarding && !onboarding.is_completed && (
        <DashboardPanel>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-semibold text-on-surface">Complete your school setup</p>
              <p className="mt-1 text-xs text-on-surface-variant">You’re almost ready. Finish the steps below to go live.</p>
            </div>
            <div className="min-w-[220px] flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(completedSteps / 5) * 100}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-on-surface-variant">{completedSteps}/5 steps completed</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[
              { key: "email_verified", label: "Verify email", href: "/dashboard/setup/bank" },
              { key: "bank_settlement", label: "Bank setup", href: "/dashboard/setup/bank" },
              { key: "classes_created", label: "Classes", href: "/dashboard/setup/classes" },
              { key: "students_added", label: "Students", href: "/dashboard/setup/students" },
              { key: "fees_configured", label: "Fees", href: "/dashboard/setup/fees" },
            ].map((step) => {
              const completed = onboarding?.steps[step.key as keyof OnboardingStatus["steps"]] ?? false;
              return (
                <div key={step.key} className="flex items-center justify-between rounded-lg border border-border/70 bg-surface-container-low px-3 py-3">
                  <div className="flex items-center gap-2">
                    {completed ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-on-surface-variant" />}
                    <span className="text-sm text-on-surface">{step.label}</span>
                  </div>
                  {!completed && <Link href={step.href} className="text-[11px] font-semibold text-primary">Set up →</Link>}
                </div>
              );
            })}
          </div>
        </DashboardPanel>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border border-border bg-white" />)
        ) : error ? (
          <div className="rounded-[1.25rem] border border-error/20 bg-error/10 p-4 text-xs text-error md:col-span-4">{error}</div>
        ) : (
          statCards.map((card) => {
            const Icon = card.icon;
            return (
              <DashboardPanel key={card.key} className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-headline text-3xl font-bold tracking-tight text-on-surface">{stats?.[card.key] ?? 0}</p>
                    <p className="mt-2 text-[11px] font-label uppercase tracking-[0.3em] text-on-surface-variant">{card.label}</p>
                  </div>
                  <Icon className="h-5 w-5 text-on-surface-variant/40" />
                </div>
              </DashboardPanel>
            );
          })
        )}
      </section>
    </DashboardPageShell>
  );
}
