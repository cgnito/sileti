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
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const onboardingStatus = useAuthStore((s) => s.onboardingStatus);

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-surface-container-low px-4 md:px-margin-desktop h-16 flex justify-between items-center">
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
        {isHydrating ? (
          // Avoid flashing the wrong state while we check localStorage / token validity.
          <div className="h-9 w-24 rounded-xl bg-surface-variant/60 animate-pulse" />
        ) : !user ? (
          <>
            <Button href="/login" variant="ghost" size="md" className="px-4 py-2">
              Sign in
            </Button>
            <Button href="/signup" size="md" className="px-5 py-2.5">
              Get started
            </Button>
          </>
        ) : onboardingStatus === "incomplete" ? (
          <Button href="/onboarding" size="md" className="px-5 py-2.5">
            Finish setup
          </Button>
        ) : (
          <Button href="/dashboard" size="md" className="px-5 py-2.5">
            Go to dashboard
          </Button>
        )}
      </div>
    </header>
  );
}
