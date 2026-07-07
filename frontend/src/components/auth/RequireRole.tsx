"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/src/features/auth/store/useAuthStore";
import { DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";

type RequireRoleProps = {
  allowedRoles?: Array<"admin" | "staff">;
  redirectTo?: string;
  children: ReactNode;
};

export function RequireRole({ allowedRoles = ["admin"], redirectTo = "/dashboard", children }: RequireRoleProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isHydrating = useAuthStore((state) => state.isHydrating);

  const isAllowed = Boolean(user && allowedRoles.includes(user.role as "admin" | "staff"));

  useEffect(() => {
    if (isHydrating) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    if (!isAllowed) {
      router.replace(redirectTo);
    }
  }, [isAllowed, isHydrating, redirectTo, router, user]);

  if (isHydrating) {
    return (
      <DashboardPageShell>
        <DashboardPanel className="grid gap-3">
          <div className="h-6 w-40 animate-pulse rounded-full bg-surface-container-low" />
          <div className="h-10 w-72 animate-pulse rounded-2xl bg-surface-container-low" />
          <div className="h-4 w-full animate-pulse rounded-full bg-surface-container-low" />
          <div className="h-4 w-5/6 animate-pulse rounded-full bg-surface-container-low" />
        </DashboardPanel>
      </DashboardPageShell>
    );
  }

  if (!user || !isAllowed) {
    return null;
  }

  return <>{children}</>;
}
