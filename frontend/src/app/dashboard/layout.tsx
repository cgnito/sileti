"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import {
  FileText,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  Receipt,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/src/components/shared/Logo";
import { fetchMySchool, fetchOnboardingStatus, logout as logoutUser } from "@/src/features/auth/api/auth.api";
import { useAuthStore } from "@/src/features/auth/store/useAuthStore";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Setup",
    items: [
      { label: "School Profile", href: "/dashboard/setup/profile", icon: UserCog, adminOnly: true },
      { label: "Bank Settlement", href: "/dashboard/setup/bank", icon: Landmark, adminOnly: true },
      { label: "Classes", href: "/dashboard/setup/classes", icon: GraduationCap },
      { label: "Students", href: "/dashboard/setup/students", icon: Users },
      { label: "Fee Templates", href: "/dashboard/setup/fees", icon: FileText },
    ],
  },
  {
    title: "Billing",
    items: [
      { label: "Invoices", href: "/dashboard/billing", icon: Receipt },
      { label: "Generate", href: "/dashboard/billing/generate", icon: PlusCircle },
    ],
  },
  {
    title: "Staff",
    items: [
      { label: "Staff Members", href: "/dashboard/staff", icon: UserCog, adminOnly: true },
      { label: "Invite Staff", href: "/dashboard/staff/invite", icon: UserPlus, adminOnly: true },
    ],
  },
];

function isActiveNavItem(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  if (href === "/dashboard/billing") return pathname === href || pathname.startsWith("/dashboard/billing/invoices/");
  if (href === "/dashboard/staff") return pathname === href || (pathname.startsWith("/dashboard/staff/") && !pathname.startsWith("/dashboard/staff/invite"));
  return pathname === href;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, org, accessToken } = useAuthStore((state) => ({
    user: state.user,
    org: state.org,
    accessToken: state.accessToken,
  }));
  const onboardingProgress = useAuthStore((state) => state.onboardingProgress);
  const isAdmin = user?.role === "admin";

  const visibleNavGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !item.adminOnly || isAdmin),
        }))
        .filter((group) => group.items.length > 0),
    [isAdmin]
  );

  useEffect(() => {
    if (!user || !accessToken || !isAdmin) return;

    async function loadAdminContext() {
      if (!org) {
        try {
          await fetchMySchool();
        } catch {
          // The admin dashboard can still render without school metadata.
        }
      }

      try {
        await fetchOnboardingStatus();
      } catch {
        // The dashboard can still render even if onboarding status is temporarily unavailable.
      }
    }

    void loadAdminContext();
  }, [accessToken, isAdmin, org, user]);

  useEffect(() => {
    if (!user || !accessToken) return;
    if (!isAdmin || !onboardingProgress) return;

    if (!onboardingProgress.is_completed && pathname === "/dashboard") {
      router.replace("/dashboard/setup");
    }
  }, [accessToken, isAdmin, onboardingProgress, pathname, router, user]);

  const schoolName = useMemo(() => org?.schoolName ?? user?.displayName ?? "Your school", [org, user]);

  function handleSignOut() {
    logoutUser();
    router.replace("/login");
  }

  return (
    <div className="relative min-h-screen bg-[linear-gradient(180deg,rgba(255,241,231,0.62),rgba(245,241,230,1))]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(121,84,46,0.09),transparent_30%),radial-gradient(circle_at_top_right,rgba(101,94,77,0.06),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(238,189,142,0.12),transparent_22%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/70 to-transparent" />

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 border-r border-white/10 bg-[linear-gradient(180deg,rgba(35,26,17,0.98),rgba(35,26,17,0.94))] px-4 py-4 backdrop-blur-xl transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <Logo className="text-surface" />
          <button className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {visibleNavGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-3 text-[10px] font-label uppercase tracking-[0.35em] text-white/30">{group.title}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActiveNavItem(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-primary text-white" : "text-white/60 hover:bg-white/8 hover:text-white"}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="truncate text-xs font-label uppercase tracking-[0.3em] text-white/50">{schoolName}</p>
            <button onClick={handleSignOut} className="mt-3 flex items-center gap-2 text-xs text-white/45 transition-colors hover:text-white">
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:ml-60">
        <header className="border-b border-border/70 bg-surface/85 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between">
            <button className="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <Logo className="text-primary" />
          </div>
        </header>
        <main className="relative min-h-screen overflow-hidden p-6 md:p-8 lg:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.4),transparent_18%)]" />
          <div className="relative z-10">{children}</div>
        </main>
      </div>

      {mobileOpen ? <button className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" /> : null}
    </div>
  );
}
