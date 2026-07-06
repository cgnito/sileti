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

function formatAmount(value: string) {
  if (!value) {
    return "Not provided";
  }

  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number(normalized);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(parsed);
}

export default function PaymentSuccessPage({ searchParams }: { searchParams?: SearchParams }) {
  const amount = formatAmount(firstValue(searchParams?.amount ?? searchParams?.amountPaid ?? searchParams?.amount_kobo));
  const studentName = firstValue(searchParams?.studentName ?? searchParams?.student_name);
  const schoolName = firstValue(searchParams?.schoolName ?? searchParams?.school_name);
  const className = firstValue(searchParams?.className ?? searchParams?.class_name);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(121,84,46,0.16),_transparent_42%),linear-gradient(180deg,_var(--color-background),_#efe3d2)] px-6 py-16 text-on-background">
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(121,84,46,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(121,84,46,0.08)_1px,transparent_1px)] [background-size:32px_32px]" />

      <section className="relative mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-2xl items-center justify-center">
        <div className="w-full rounded-[1.25rem] border border-border bg-card/95 p-8 shadow-[0_24px_80px_rgba(44,22,0,0.12)] backdrop-blur-sm md:p-12">
          <p className="font-label text-xs uppercase tracking-[0.3em] text-primary">
            Payment received
          </p>

          <h1 className="mt-4 font-headline text-3xl leading-tight text-on-surface md:text-5xl">
            Payment successful.
          </h1>

          <p className="mt-4 max-w-xl text-base leading-7 text-on-surface-variant md:text-lg">
            Your payment was recorded successfully.
          </p>
        </div>
      </section>
    </main>
  );
}