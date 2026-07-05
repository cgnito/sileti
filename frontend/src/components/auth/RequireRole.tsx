"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/src/features/auth/store/useAuthStore";

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
    return null;
  }

  if (!user || !isAllowed) {
    return null;
  }

  return <>{children}</>;
}
