"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { OnboardingBanner } from "@/src/components/dashboard/OnboardingBanner";
import { DashboardHero, DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";
import { useAuthStore } from "@/src/features/auth/store/useAuthStore";

const setupLinks = [
  { href: "/dashboard/setup/profile", title: "School profile", description: "Update your school name and login details", adminOnly: true },
  { href: "/dashboard/setup/bank", title: "Bank settlement", description: "Add payout and bank verification details", adminOnly: true },
  { href: "/dashboard/setup/classes", title: "Classes", description: "Create and manage school classes" },
  { href: "/dashboard/setup/students", title: "Students", description: "Add or import students" },
  { href: "/dashboard/setup/fees", title: "Fees", description: "Create fee templates for billing" },
];

export default function DashboardSetupPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "admin";

  const visibleSetupLinks = setupLinks.filter((link) => !link.adminOnly || isAdmin);

  return (
    <DashboardPageShell>
      <DashboardHero
        eyebrow="Setup hub"
        title="Complete your school setup"
        description="Finish each required step to make your dashboard fully ready for billing and school operations."
      />

      {isAdmin ? <OnboardingBanner /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {visibleSetupLinks.map((link) => (
          <DashboardPanel key={link.href} className="transition-transform hover:-translate-y-0.5">
            <Link href={link.href} className="group flex h-full flex-col justify-between gap-5">
              <div>
                <h2 className="font-headline text-xl text-on-surface">{link.title}</h2>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">{link.description}</p>
              </div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Continue
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          </DashboardPanel>
        ))}
      </div>
    </DashboardPageShell>
  );
}
