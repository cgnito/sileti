"use client";

import { useAuthStore } from "@/src/features/auth/store/useAuthStore";
import Image from "next/image";
import { Button } from "../shared/Button";

export function Hero() {
  const user = useAuthStore((s) => s.user);
  const org = useAuthStore((s) => s.org);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const onboardingProgress = useAuthStore((s) => s.onboardingProgress);


  // org is null until fetchMySchool() resolves.
  const greetingName = org?.schoolName ?? user?.displayName;
  const isSignedIn = Boolean(user);
  const showSignedInCta = !isHydrating && isSignedIn;
  const primaryHref = onboardingProgress?.is_completed ? "/dashboard" : "/dashboard/setup";
  const primaryLabel = onboardingProgress?.is_completed ? "Go to dashboard" : "Continue setup";

  return (
    <section className="relative mt-7 flex min-h-[80vh] flex-col items-center justify-center overflow-hidden bg-surface-bright px-4 pt-16 text-center md:px-margin-desktop">
      <div className="max-w-4xl z-10">
        <span className="inline-block px-4 py-1.5 mb-6 bg-secondary-container text-on-secondary-container text-xs font-label rounded-full tracking-widest uppercase font-semibold">
          The School OS
        </span>

        <h1 className="font-headline text-4xl font-bold leading-tight tracking-tight text-on-surface md:text-5xl">
          {showSignedInCta && greetingName ? (
            <>
              Welcome back,{" "}
              <span className="italic text-primary">{greetingName}</span>
            </>
          ) : (
            <>
              The Modern Operating System for
              <br className="hidden md:block" />{" "}
              <span className="italic text-primary">African Excellence</span>
            </>
          )}
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
          {showSignedInCta
            ? "Jump straight back into your school workspace, continue setup, or open the dashboard."
            : "Automate your finances, streamline academics, and synchronize operations. Empowering African educational institutions with world-class digital infrastructure."}
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          {showSignedInCta ? (
            <Button href={primaryHref} size="sm" className="w-full px-5 py-3 sm:w-auto md:px-8 md:py-4">
              {primaryLabel}
            </Button>
          ) : (
            <Button href="/signup" size="sm" className="w-full px-5 py-3 sm:w-auto md:px-8 md:py-4">
              Get started for free
            </Button>
          )}
          <Button href="#demo" variant="secondary" size="sm" className="w-full px-5 py-3 sm:w-auto md:px-8 md:py-4">
            Book a live demo
          </Button>
        </div>
       
      </div>

      {/* Hero Display Frame */}
      <div className="mt-16 w-full max-w-5xl mx-auto rounded-t-2xl border-x border-t border-border/80 bg-card shadow-2xl p-3 md:p-6 translate-y-8">
        <div className="bg-surface-container rounded-xl overflow-hidden border border-outline-variant aspect-video shadow-inner relative">
          <Image
            src="/dashboard-preview.png"
            alt="ṣilẹti dashboard preview"
            fill
            className="object-cover opacity-95 select-none"
            priority
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card/40 to-transparent" />
        </div>
      </div>
    </section>
  );
}
