"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { fetchMySchool, logout as logoutUser } from "@/src/features/auth/api/auth.api";
import { useAuthStore } from "@/src/features/auth/store/useAuthStore";

const navGroups = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Setup",
    items: [
      { label: "Bank Settlement", href: "/dashboard/setup/bank", icon: Landmark },
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
      { label: "Staff Members", href: "/dashboard/staff", icon: UserCog },
      { label: "Invite Staff", href: "/dashboard/staff/invite", icon: UserPlus },
    ],
  },
] as const;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, org, accessToken } = useAuthStore((state) => ({
    user: state.user,
    org: state.org,
    accessToken: state.accessToken,
  }));

  useEffect(() => {
    if (!user || !accessToken || org) return;
    void fetchMySchool();
  }, [accessToken, org, user]);

  const schoolName = useMemo(() => org?.schoolName ?? user?.displayName ?? "Your school", [org, user]);

  function handleSignOut() {
    logoutUser();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-surface">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 border-r border-white/10 bg-on-surface px-4 py-4 transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <Logo className="text-surface" />
          <button className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-3 text-[10px] font-label uppercase tracking-[0.35em] text-white/30">{group.title}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
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
        <header className="border-b border-border/70 bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between">
            <button className="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <Logo className="text-primary" />
          </div>
        </header>
        <main className="min-h-screen bg-surface p-6 md:p-8">{children}</main>
      </div>

      {mobileOpen ? <button className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" /> : null}
    </div>
  );
}
