"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/src/features/auth/store/useAuthStore";

import { Navbar } from "@/src/components/landing/Navbar";
import { Hero } from "@/src/components/landing/Hero";
import { SocialProofMarquee } from "@/src/components/landing/SocialProofMarquee";
import { ValuePropositionGrid } from "@/src/components/landing/ValuePropositionGrid";
import { Pricing } from "@/src/components/landing/Pricing";
import { FAQ } from "@/src/components/landing/FAQ";
import { FinalCTA } from "@/src/components/landing/FinalCTA";
import { Footer } from "@/src/components/landing/Footer";
import { HowItWorks } from "../components/landing/HowItWorks";

export default function LandingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const onboardingProgress = useAuthStore((s) => s.onboardingProgress);

  // A fully onboarded admin landing here (e.g. via a stale bookmark or
  // typing "/" manually) doesn't need the marketing page — send them
  // straight to the dashboard. Logged-out visitors and mid-onboarding
  // admins see the marketing page as normal (the latter gets a
  // "continue setup" framing instead of a hard redirect, since they
  // may have intentionally navigated here).
  useEffect(() => {
    if (!isHydrating && user && onboardingProgress?.is_completed) {
      router.replace("/dashboard");
    }
  }, [isHydrating, user, onboardingProgress, router]);

  if (!isHydrating && user && onboardingProgress?.is_completed) {
    // Avoid flashing marketing content during the redirect.
    return null;
  }

  return (
    <main>
      <Navbar />
      <Hero />
      <SocialProofMarquee />
      <ValuePropositionGrid />
      <HowItWorks/>
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
