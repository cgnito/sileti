"use client";

import Image from "next/image";
import { useAuthStore } from "@/src/features/auth/store/useAuthStore";
import { Button } from "@/src/components/shared/Button";

export function Hero() {
  const user = useAuthStore((s) => s.user);
  const org = useAuthStore((s) => s.org);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const onboardingStatus = useAuthStore((s) => s.onboardingStatus);

  const loggedInIncomplete = !isHydrating && user && onboardingStatus === "incomplete";

  return (
    <section className="relative min-h-[80vh] my-7 flex flex-col items-center justify-center text-center px-4 md:px-margin-desktop overflow-hidden bg-surface-bright pt-16">
      <div className="max-w-4xl z-10">
        <span className="inline-block px-4 py-1.5 mb-6 bg-secondary-container text-on-secondary-container text-xs font-label rounded-full tracking-widest uppercase">
          The School OS
        </span>

        {loggedInIncomplete ? (
          <>
            <h1 className="font-headline text-4xl md:text-5xl font-bold text-on-surface mb-6 leading-tight">
              Welcome back{org ? `, ${org.name}` : ""}.
              <br className="hidden md:block" />
              <span className="italic text-primary">Let&apos;s finish setting up.</span>
            </h1>
            <p className="font-body text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              You&apos;re a few steps away from collecting your first fee. Pick up
              where you left off.
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <Button href="/onboarding" size="lg">
                Continue setup
              </Button>
              <Button href="/dashboard" variant="secondary" size="lg">
                Go to dashboard instead
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-headline text-4xl md:text-5xl font-bold text-on-surface mb-6 leading-tight">
              The Modern Operating System for
              <br className="hidden md:block" />{" "}
              <span className="italic text-primary">African Excellence</span>
            </h1>
            <p className="font-body text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              Automate your finances, streamline academics, and synchronize
              operations. Empowering African educational institutions with
              world-class digital infrastructure.
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <Button href="/signup" size="md">
                Get started for free
              </Button>
              <Button href="#demo" variant="secondary" size="md">
                Book a live demo
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="mt-16 w-full max-w-5xl mx-auto rounded-t-3xl border-x border-t border-border bg-card shadow-2xl p-4 md:p-8 translate-y-8">
        <div className="bg-surface-container rounded-2xl overflow-hidden border border-outline-variant aspect-video shadow-inner relative">
          <Image
            src="/dashboard-preview.png"
            alt="ṣilẹti dashboard preview"
            fill
            className="object-cover opacity-90"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
        </div>
      </div>
    </section>
  );
}
