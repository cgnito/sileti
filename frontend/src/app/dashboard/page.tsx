"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Check,
  CircleDollarSign,
  FileText,
  ReceiptText,
  School,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiClient } from "@/src/shared/api-client";
import { fetchOnboardingStatus } from "@/src/features/auth/api/auth.api";
import type { OnboardingProgress } from "@/src/features/auth/types/auth.types";
import { useAuthStore } from "@/src/features/auth/store/useAuthStore";
import { DashboardHero, DashboardPageShell } from "@/src/components/dashboard/PageChrome";

type DashboardTrendPoint = {
  label: string;
  billed: number;
  collected: number;
};

type DashboardBreakdownPoint = {
  label: string;
  value: number;
};

type DashboardSummary = {
  students_count: number;
  classes_count: number;
  fee_templates_count: number;
  invoices_count: number;
  paid_invoices_count: number;
  unpaid_invoices_count: number;
  partially_paid_invoices_count: number;
  voided_invoices_count: number;
  total_income: number;
  total_collected: number;
  total_outstanding: number;
  collection_rate_pct: number;
};

type DashboardMetricsResponse = {
  summary: DashboardSummary;
  invoice_breakdown: DashboardBreakdownPoint[];
  revenue_trend: DashboardTrendPoint[];
};

type SetupStep = {
  key: keyof OnboardingProgress["steps"];
  label: string;
  href: string;
};

const setupSteps: SetupStep[] = [
  { key: "email_verified", label: "Verify email", href: "/verify-email" },
  { key: "bank_settlement", label: "Bank settlement", href: "/dashboard/setup/bank" },
  { key: "classes_created", label: "Classes", href: "/dashboard/setup/classes" },
  { key: "students_added", label: "Students", href: "/dashboard/setup/students" },
  { key: "fees_configured", label: "Fees", href: "/dashboard/setup/fees" },
];

const breakdownColors: Record<string, string> = {
  Paid: "#7c5c2a",
  Unpaid: "#d8c2a4",
  "Partially paid": "#a96d3a",
  Voided: "#cdbba7",
};

function formatCurrency(value: number | null | undefined) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function formatCompactCurrency(value: number | null | undefined) {
  const numeric = Number(value ?? 0);
  return `₦${new Intl.NumberFormat("en-NG", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numeric)}`;
}

/* ---------------------------------------------------------------------- *
 *  Shared "ledger paper" chrome: a torn/perforated edge that turns every
 *  card into a stub torn from the same receipt booklet. This is the one
 *  signature device reused everywhere so the page reads as one artifact.
 * ---------------------------------------------------------------------- */
function ReceiptEdge({ position = "top" }: { position?: "top" | "bottom" }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute left-0 right-0 h-3 ${position === "top" ? "-top-[1px]" : "-bottom-[1px] rotate-180"}`}
      style={{
        backgroundImage:
          "radial-gradient(circle at 7px 6px, transparent 6px, var(--edge-color, #fdfaf4) 6.5px)",
        backgroundSize: "14px 14px",
        backgroundPositionX: "3px",
      }}
    />
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-border/70 bg-white/95 px-4 py-3 shadow-lg shadow-black/5 backdrop-blur-sm">
      <p className="font-label text-[10px] font-semibold uppercase tracking-[0.3em] text-on-surface-variant">{label}</p>
      <div className="mt-2 space-y-1 text-sm">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4 text-on-surface">
            <span>{item.name}</span>
            <span className="font-label font-semibold tabular-nums">{formatCurrency(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  accent = false,
  stampValue,
  delay = 0,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Banknote;
  accent?: boolean;
  stampValue?: string;
  delay?: number;
}) {
  return (
    <div
      className="dash-rise group relative overflow-hidden rounded-[1.35rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(253,250,244,0.9))] p-5 pt-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#7c5c2a]/10"
      style={{ animationDelay: `${delay}ms` }}
    >
      <ReceiptEdge />
      {accent ? (
        <span className="absolute -right-2 -top-2 h-16 w-16 rounded-full bg-primary/10 blur-2xl transition-opacity duration-300 group-hover:opacity-70" aria-hidden />
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-label text-[11px] uppercase tracking-[0.3em] text-on-surface-variant">{label}</p>
          <p className="mt-3 truncate font-headline text-3xl tracking-tight text-on-surface tabular-nums">{value}</p>
          <p className="mt-2 text-sm leading-5 text-on-surface-variant">{helper}</p>
        </div>
        <div className="shrink-0 rounded-2xl border border-border/70 bg-surface-container-low p-3 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>

      {stampValue ? (
        <div
          className="pointer-events-none absolute -bottom-2 -right-3 select-none rounded-full border-2 border-primary/40 px-4 py-2 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-primary/70"
          style={{ transform: "rotate(-9deg)" }}
          aria-hidden
        >
          {stampValue}
        </div>
      ) : null}
    </div>
  );
}

function LedgerLine({
  label,
  value,
  icon: Icon,
  delay = 0,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  delay?: number;
}) {
  return (
    <div
      className="dash-rise flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-surface-container-low">
        <Icon className="h-4 w-4 text-on-surface-variant" />
      </div>
      <div className="flex w-full items-end gap-2">
        <span className="min-w-0 text-sm text-on-surface-variant">{label}</span>
        <span className="mx-1 hidden min-w-0 flex-1 translate-y-[-2px] border-b border-dotted border-border sm:block" aria-hidden />
        <span className="font-label whitespace-nowrap text-base font-semibold tabular-nums text-on-surface">{value}</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isHydrating = useAuthStore((state) => state.isHydrating);
  const isAdmin = user?.role === "admin";
  const [onboarding, setOnboarding] = useState<OnboardingProgress | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetricsResponse | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      setMetrics(null);
      setMetricsError(null);
      setOnboarding(null);
      setOnboardingError(null);

      const metricsPromise = apiClient.get<DashboardMetricsResponse>("/orgs/dashboard-metrics");
      const onboardingPromise = isAdmin ? fetchOnboardingStatus() : Promise.resolve(null);

      const [onboardingResult, metricsResult] = await Promise.allSettled([onboardingPromise, metricsPromise]);

      if (!active) return;

      if (onboardingResult.status === "fulfilled" && onboardingResult.value) {
        setOnboarding(onboardingResult.value);
      } else if (isAdmin && onboardingResult.status === "rejected") {
        setOnboardingError(onboardingResult.reason instanceof Error ? onboardingResult.reason.message : "We could not load your setup progress.");
      }

      if (metricsResult.status === "fulfilled") {
        setMetrics(metricsResult.value);
      } else {
        setMetricsError(metricsResult.reason instanceof Error ? metricsResult.reason.message : "We could not load your dashboard metrics.");
      }

      setIsLoading(false);
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [isAdmin, user]);

  const completedSteps = useMemo(() => {
    if (!onboarding) return 0;
    return setupSteps.filter((step) => onboarding.steps[step.key]).length;
  }, [onboarding]);

  const setupPercent = onboarding ? Math.round((completedSteps / setupSteps.length) * 100) : 0;

  const summary = metrics?.summary;
  const trendData = metrics?.revenue_trend ?? [];
  const breakdownData = metrics?.invoice_breakdown ?? [];
  const breakdownTotal = breakdownData.reduce((sum, item) => sum + item.value, 0);

  if (!user) return null;

  const greetingDate = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date());

  return (
    <DashboardPageShell className="max-w-7xl">
      {/* Local styles: staggered rise-in + reduced-motion respect. Scoped, no external deps. */}
      <style>{`
        @keyframes dash-rise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dash-rise { animation: dash-rise 0.5s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .dash-rise { animation: none; }
        }
      `}</style>

      <div className="relative overflow-hidden rounded-[1.6rem]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(124,92,42,0.16) 1px, transparent 0)",
            backgroundSize: "16px 16px",
          }}
          aria-hidden
        />
        <DashboardHero
          eyebrow="Overview"
          title={`Good morning, ${user.displayName}`}
          description={
            <>
              {greetingDate}
              <span className="mt-1 block border-b border-dotted border-border/80 pb-2 text-sm text-on-surface-variant">
                A clean financial snapshot of fees, collections, and student activity.
              </span>
            </>
          }
          action={(
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/dashboard/billing/generate"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
              >
                Generate invoices
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/dashboard/setup"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/70 bg-white/80 px-4 py-2.5 text-sm font-semibold text-on-surface transition-all hover:-translate-y-0.5 hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
              >
                Setup hub
              </Link>
            </div>
          )}
        />
      </div>

      {isAdmin && onboarding && !onboarding.is_completed ? (
        <section className="relative overflow-hidden rounded-[1.45rem] border border-border/70 bg-white/80 p-5 pt-6 backdrop-blur-sm">
          <ReceiptEdge />
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="font-label text-[11px] uppercase tracking-[0.3em] text-primary">Setup progress</p>
              <h2 className="mt-2 font-headline text-xl text-on-surface">Finish onboarding to unlock the full dashboard</h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                {completedSteps}/{setupSteps.length} steps complete. Continue the remaining items when you are ready.
              </p>
            </div>
            <div className="min-w-[240px]">
              <div className="flex items-center justify-between text-sm text-on-surface-variant">
                <span>Progress</span>
                <span className="font-label font-semibold text-on-surface">{setupPercent}%</span>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-border/70"
                role="progressbar"
                aria-valuenow={setupPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Onboarding progress"
              >
                <div className="h-full rounded-full bg-primary transition-all duration-700 ease-out" style={{ width: `${setupPercent}%` }} />
              </div>
            </div>
          </div>

          {/* Stamped approval trail: order is real here (sequential setup steps), so the
              connecting line and numbering carry genuine meaning. */}
          <div className="relative mt-6">
            <div className="absolute left-0 right-0 top-[19px] hidden border-t border-dashed border-border md:block" aria-hidden />
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
              {setupSteps.map((step, index) => {
                const completed = onboarding.steps[step.key];
                return (
                  <div key={step.key} className="relative flex flex-col items-center gap-2 text-center">
                    <div
                      className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-white text-sm font-semibold transition-all ${
                        completed
                          ? "border-primary text-primary"
                          : "border-border text-on-surface-variant"
                      }`}
                      style={completed ? { transform: "rotate(-6deg)" } : undefined}
                    >
                      {completed ? <Check className="h-4 w-4" /> : index + 1}
                    </div>
                    <span className="text-xs font-medium text-on-surface">{step.label}</span>
                    {!completed ? (
                      <Link href={step.href} className="font-label text-[11px] font-semibold text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        Continue
                      </Link>
                    ) : (
                      <span className="font-label text-[11px] font-medium text-on-surface-variant">Done</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {metricsError ? (
        <section className="flex items-start gap-2 rounded-[1.35rem] border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {metricsError}
        </section>
      ) : null}

      {onboardingError ? (
        <section className="flex items-start gap-2 rounded-[1.35rem] border border-border/70 bg-white/80 px-4 py-3 text-sm text-on-surface-variant">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {onboardingError}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[160px] animate-pulse rounded-[1.35rem] border border-border/70 bg-white/70" />
          ))
        ) : summary ? (
          <>
            <MetricCard
              label="Total collected"
              value={formatCurrency(summary.total_collected)}
              helper="Money received from successful payments."
              icon={Banknote}
              delay={0}
            />
            <MetricCard
              label="Total billed"
              value={formatCurrency(summary.total_income)}
              helper="Total value of active invoices issued."
              icon={ReceiptText}
              delay={60}
            />
            <MetricCard
              label="Outstanding balance"
              value={formatCurrency(summary.total_outstanding)}
              helper="Unpaid amount still sitting on the ledger."
              icon={CircleDollarSign}
              delay={120}
            />
            <MetricCard
              label="Collection rate"
              value={`${summary.collection_rate_pct.toFixed(1)}%`}
              helper="Share of billed fees already collected."
              icon={TrendingUp}
              accent
              stampValue={summary.collection_rate_pct >= 80 ? "On Track" : undefined}
              delay={180}
            />
          </>
        ) : null}
      </section>

      <section className="relative overflow-hidden rounded-[1.45rem] border border-border/70 bg-white/80 p-5 pt-6 backdrop-blur-sm">
        <ReceiptEdge />
        <p className="font-label text-[11px] uppercase tracking-[0.3em] text-primary">Ledger at a glance</p>
        {isLoading ? (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-lg bg-surface-container-low" />
            ))}
          </div>
        ) : summary ? (
          <div className="mt-1 divide-y divide-border/60">
            <LedgerLine label="Students" value={summary.students_count.toLocaleString("en-NG")} icon={Users} delay={0} />
            <LedgerLine label="Classes" value={summary.classes_count.toLocaleString("en-NG")} icon={School} delay={40} />
            <LedgerLine label="Fee templates" value={summary.fee_templates_count.toLocaleString("en-NG")} icon={FileText} delay={80} />
            <LedgerLine label="Invoices" value={summary.invoices_count.toLocaleString("en-NG")} icon={FileText} delay={120} />
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="relative overflow-hidden rounded-[1.45rem] border border-border/70 bg-white/80 p-5 pt-6 backdrop-blur-sm">
          <ReceiptEdge />
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-label text-[11px] uppercase tracking-[0.3em] text-primary">Revenue trend</p>
              <h2 className="mt-2 font-headline text-xl text-on-surface">Billed vs collected</h2>
            </div>
            <span className="font-label rounded-full border border-border/70 bg-surface-container-low px-3 py-1 text-xs font-medium text-on-surface-variant">
              Last 6 months
            </span>
          </div>
          <div className="mt-5 h-[260px] sm:h-[300px] md:h-[340px]">
            {isLoading ? (
              <div className="h-full animate-pulse rounded-[1.25rem] border border-border/70 bg-surface-container-low" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="billedFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#d8c2a4" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#d8c2a4" stopOpacity={0.06} />
                    </linearGradient>
                    <linearGradient id="collectedFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#7c5c2a" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#7c5c2a" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eadfce" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} stroke="#8d7f6a" style={{ fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={10} tickFormatter={(value) => formatCompactCurrency(Number(value))} stroke="#8d7f6a" style={{ fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="billed" name="Billed" stroke="#d8c2a4" fill="url(#billedFill)" strokeWidth={2} activeDot={{ r: 5 }} />
                  <Area type="monotone" dataKey="collected" name="Collected" stroke="#7c5c2a" fill="url(#collectedFill)" strokeWidth={2} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[1.45rem] border border-border/70 bg-white/80 p-5 pt-6 backdrop-blur-sm">
          <ReceiptEdge />
          <div>
            <p className="font-label text-[11px] uppercase tracking-[0.3em] text-primary">Invoice status</p>
            <h2 className="mt-2 font-headline text-xl text-on-surface">Payment mix</h2>
          </div>
          <div className="mt-5 h-[240px] sm:h-[270px] md:h-[300px]">
            {isLoading ? (
              <div className="h-full animate-pulse rounded-[1.25rem] border border-border/70 bg-surface-container-low" />
            ) : breakdownData.length > 0 ? (
              <div className="relative h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={<ChartTooltip />} />
                    <Pie
                      data={breakdownData}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={74}
                      outerRadius={112}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {breakdownData.map((entry) => (
                        <Cell key={entry.label} fill={breakdownColors[entry.label] ?? "#c7b299"} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full border border-border/70 bg-white/95 px-5 py-4 text-center shadow-sm">
                    <p className="font-label text-[10px] uppercase tracking-[0.3em] text-on-surface-variant">Invoices</p>
                    <p className="mt-2 font-headline text-2xl tabular-nums text-on-surface">{breakdownTotal.toLocaleString("en-NG")}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid gap-2">
            {breakdownData.map((item) => {
              const pct = breakdownTotal > 0 ? Math.round((item.value / breakdownTotal) * 100) : 0;
              return (
                <div key={item.label} className="flex items-center justify-between rounded-xl border border-border/70 bg-surface-container-low px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: breakdownColors[item.label] ?? "#c7b299" }} />
                    <span className="text-sm text-on-surface">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-label text-xs text-on-surface-variant">{pct}%</span>
                    <span className="font-label text-sm font-semibold tabular-nums text-on-surface">{item.value.toLocaleString("en-NG")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </DashboardPageShell>
  );
}
