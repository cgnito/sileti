import Link from "next/link";
import { CheckCircle2, ArrowLeft, ReceiptText, School, UserRound } from "lucide-react";

export const metadata = {
  title: "Payment Successful | ṣilẹti",
  description: "Confirmation page shown after a successful Nomba checkout.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatAmount(value: string, scaleToNaira = false) {
  if (!value) {
    return "Not provided";
  }

  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number(normalized);
  const numeric = scaleToNaira ? parsed / 100 : parsed;

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(numeric);
}

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};

  const amount = resolvedSearchParams.amount_kobo
    ? formatAmount(firstValue(resolvedSearchParams.amount_kobo), true)
    : formatAmount(firstValue(resolvedSearchParams.amount ?? resolvedSearchParams.amountPaid));
  const studentName = firstValue(resolvedSearchParams.studentName ?? resolvedSearchParams.student_name);
  const schoolName = firstValue(resolvedSearchParams.schoolName ?? resolvedSearchParams.school_name);
  const className = firstValue(resolvedSearchParams.className ?? resolvedSearchParams.class_name);
  const reference = firstValue(resolvedSearchParams.reference ?? resolvedSearchParams.orderReference ?? resolvedSearchParams.merchantTxRef);
  const statusLabel = amount === "Not provided" ? "Checkout completed" : "Payment recorded";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(121,84,46,0.18),_transparent_40%),linear-gradient(180deg,_var(--color-background),_#f2e6d8)] px-5 py-10 text-on-background sm:px-6 sm:py-14">
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(121,84,46,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(121,84,46,0.08)_1px,transparent_1px)] [background-size:32px_32px]" />

      <section className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-[1.6rem] border border-border/70 bg-card/95 shadow-[0_22px_70px_rgba(44,22,0,0.11)] backdrop-blur-sm">
          <div className="border-b border-border/70 bg-surface-container-low/70 px-6 py-5 sm:px-8">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">{statusLabel}</p>
                <h1 className="mt-1 font-headline text-2xl tracking-tight text-on-surface sm:text-4xl">
                  Payment successful.
                </h1>
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <p className="max-w-xl text-base leading-7 text-on-surface-variant sm:text-lg">
                Your checkout has been received. We&apos;ll reconcile it against the invoice shortly and update the school ledger.
              </p>

              <div className="grid gap-3 rounded-[1.25rem] border border-border/70 bg-white p-4 sm:grid-cols-2">
                <DetailRow icon={ReceiptText} label="Amount" value={amount} />
                <DetailRow icon={UserRound} label="Student" value={studentName || "Not provided"} />
                <DetailRow icon={School} label="School" value={schoolName || "Not provided"} />
                <DetailRow icon={CheckCircle2} label="Class" value={className || "Not provided"} />
              </div>

              {reference ? (
                <p className="text-xs text-on-surface-variant">
                  Reference: <span className="font-medium text-on-surface">{reference}</span>
                </p>
              ) : null}
            </div>

            <div className="rounded-[1.25rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,244,236,0.92))] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-on-surface-variant">Next step</p>
              <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                If you received this page after paying, you do not need to do anything else. The school will receive the payment update automatically once the webhook settles.
              </p>

              <div className="mt-5 flex flex-col gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to site
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-white px-4 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low"
                >
                  Continue to login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface-container-low px-3 py-3">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">{label}</p>
        <p className="mt-1 truncate text-sm font-medium text-on-surface">{value}</p>
      </div>
    </div>
  );
}
