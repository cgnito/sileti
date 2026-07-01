"use client";

import Link from "next/link";
import { OnboardingBanner } from "@/src/components/dashboard/OnboardingBanner";

const setupLinks = [
  { href: "/dashboard/setup/bank", title: "Bank settlement", description: "Add payout and bank verification details" },
  { href: "/dashboard/setup/classes", title: "Classes", description: "Create and manage school classes" },
  { href: "/dashboard/setup/students", title: "Students", description: "Add or import students" },
  { href: "/dashboard/setup/fees", title: "Fees", description: "Create fee templates for billing" },
];

export default function DashboardSetupPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-8 md:px-10 lg:px-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <p className="font-label text-xs uppercase tracking-[0.25em] text-primary">Setup hub</p>
          <h1 className="mt-2 font-headline text-3xl text-on-surface">Complete your school setup</h1>
          <p className="mt-3 max-w-2xl text-sm text-on-surface-variant">
            Finish each required step to make your dashboard fully ready for billing and school operations.
          </p>
        </header>

        <OnboardingBanner />

        <div className="grid gap-4 md:grid-cols-2">
          {setupLinks.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition-transform hover:-translate-y-0.5">
              <h2 className="font-headline text-xl text-on-surface">{link.title}</h2>
              <p className="mt-2 text-sm text-on-surface-variant">{link.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
