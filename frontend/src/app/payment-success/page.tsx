import Link from "next/link";
import { CheckCircle2, ArrowLeft, ShieldCheck, MessageCircle } from "lucide-react";

export const metadata = {
  title: "Payment Successful | ṣilẹti",
  description: "Confirmation page shown after a successful Nomba checkout.",
};

export default function PaymentSuccessPage() {
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">Checkout completed</p>
                <h1 className="mt-1 font-headline text-2xl tracking-tight text-on-surface sm:text-4xl">
                  Payment successful.
                </h1>
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <p className="max-w-xl text-base leading-7 text-on-surface-variant sm:text-lg">
                Your checkout was received successfully. The school will reconcile it automatically from the backend once the payment update is confirmed.
              </p>

              <div className="grid gap-3 rounded-[1.25rem] border border-border/70 bg-white p-4 sm:grid-cols-2">
                <DetailRow icon={ShieldCheck} label="Secure status" value="Payment captured" />
                <DetailRow icon={MessageCircle} label="Next step" value="Return to the chatbot if needed" />
                <DetailRow icon={CheckCircle2} label="Ledger update" value="Handled automatically" />
                <DetailRow icon={ArrowLeft} label="No action needed" value="You can close this page" />
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,244,236,0.92))] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-on-surface-variant">What happens next</p>
              <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                We will update the invoice status in the background. If you need to continue with another payment or check a different invoice, go back to the site or open the chatbot flow again.
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
