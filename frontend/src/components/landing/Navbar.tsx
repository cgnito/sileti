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

  // Check if an auth token or session key exists in storage.
  // Replace 'auth-token' with whatever key your app or Zustand persist middleware uses.
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("auth-token");

  // Only show the skeleton if the store is hydrating AND a token actually exists to be validated.
  // If there's no token, we instantly know they are a guest.
  const showSkeleton = isHydrating && hasToken;

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-surface-container-low px-4 py-10 md:px-margin-desktop h-16 flex justify-between items-center">
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
          <div className="h-9 w-24 rounded-xl bg-surface-variant/60 animate-pulse" />
        ) : !user ? (
          <>
            <Button href="/login" variant="ghost" size="md" >
              Sign in
            </Button>
            <Button href="/signup" size="md" className="">
              Get started
            </Button>
          </>
        ) 
        : (
          <Button href="/dashboard" size="md" className="">
            Go to dashboard
          </Button>
        )}
      </div>
    </header>
  );
}