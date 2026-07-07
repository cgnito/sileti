"use client";

import { useAuthStore } from "@/src/features/auth/store/useAuthStore";
import { Logo } from "@/src/components/shared/Logo";
import { Button } from "@/src/components/shared/Button";

const navLinks = [
  { label: "Platform", href: "#platform" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function Navbar() {
  const user = useAuthStore((s) => s.user);
  const onboardingProgress = useAuthStore((s) => s.onboardingProgress);
  const isHydrating = useAuthStore((s) => s.isHydrating);

  // Check if an auth token or session key exists in storage.
  // Replace 'auth-token' with whatever key your app or Zustand persist middleware uses.
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("auth-token");

  // Only show the skeleton if the store is hydrating AND a token actually exists to be validated.
  // If there's no token, we instantly know they are a guest.
  const showSkeleton = isHydrating && hasToken;
  const dashboardHref = onboardingProgress?.is_completed ? "/dashboard" : "/dashboard/setup";
  const dashboardLabel = onboardingProgress?.is_completed ? "Dashboard" : "Continue setup";

  return (
    <header className="fixed top-0 left-0 z-50 flex h-16 w-full items-center justify-between border-b border-outline-variant/60 bg-surface-container-low/95 px-4 backdrop-blur md:px-margin-desktop">
      <div className="flex items-center gap-8">
        <Logo />
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-label text-on-surface-variant hover:text-primary-container transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {showSkeleton ? (
          // Only flashes for returning users while Zustand finishes reading storage.
          <div className="h-8 w-20 rounded-xl bg-surface-variant/60 animate-pulse md:h-9 md:w-24" />
        ) : !user ? (
          <>
            <Button href="/login" variant="ghost" size="sm" className="px-3 py-2 md:px-6 md:py-3">
              Sign in
            </Button>
            <Button href="/signup" size="sm" className="px-3 py-2 md:px-6 md:py-3">
              Get started
            </Button>
          </>
        ) 
        : (
          <Button href={dashboardHref} size="sm" className="px-3 py-2 md:px-6 md:py-3">
            {dashboardLabel}
          </Button>
        )}
      </div>
    </header>
  );
}
