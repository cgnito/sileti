"use client";

import { useAuthStore } from "@/src/features/auth/store/useAuthStore";
import Image from "next/image";
import { Button } from "../shared/Button";

export function Hero() {
  const user = useAuthStore((s) => s.user);
  const org = useAuthStore((s) => s.org);
  const isHydrating = useAuthStore((s) => s.isHydrating);


  // org is null until fetchMySchool() resolves.
  const greetingName = org?.schoolName ?? user?.displayName;

  return (
    <section className="relative min-h-[80vh] mt-7 flex flex-col items-center justify-center text-center px-4 md:px-margin-desktop overflow-hidden bg-surface-bright pt-16">
      <div className="max-w-4xl z-10">
        <span className="inline-block px-4 py-1.5 mb-6 bg-secondary-container text-on-secondary-container text-xs font-label rounded-full tracking-widest uppercase font-semibold">
          The School OS
        </span>

          <>
            <h1 className="font-headline text-4xl md:text-5xl font-bold text-on-surface mb-6 leading-tight tracking-tight">
              The Modern Operating System for
              <br className="hidden md:block" />{" "}
              <span className="italic text-primary">African Excellence</span>
            </h1>
            <p className="font-body text-sm md:text-base text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
              Automate your finances, streamline academics, and synchronize
              operations. Empowering African educational institutions with
              world-class digital infrastructure.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Button href="/signup" size="md" className="w-full sm:w-auto">
                Get started for free
              </Button>
              <Button href="#demo" variant="secondary" size="md" className="w-full sm:w-auto">
                Book a live demo
              </Button>
            </div>
          </>
       
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