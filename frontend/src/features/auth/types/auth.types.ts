// Shared auth/session types used across the store and auth hooks.
// Keep this in sync with auth.types.ts once that file is wired to the
// real backend response shapes (GET /users/me, POST /auth/login).

export type UserRole = "admin" | "bursar" | "teacher";

export interface SileteUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface SileteOrg {
  id: string;
  name: string;
  shortCode: string;
  slug: string;
}

/**
 * Coarse onboarding status, derived client-side from what we know about
 * the org. The backend has no explicit "onboarding complete" flag today —
 * this is inferred. Update this once a real status field exists.
 */
export type OnboardingStatus = "incomplete" | "complete";

export interface AuthState {
  user: SileteUser | null;
  org: SileteOrg | null;
  onboardingStatus: OnboardingStatus;
  accessToken: string | null;
  /** True only while we're rehydrating/validating a persisted session on load. */
  isHydrating: boolean;

  setSession: (params: {
    user: SileteUser;
    org: SileteOrg | null;
    accessToken: string;
    onboardingStatus?: OnboardingStatus;
  }) => void;
  setOnboardingStatus: (status: OnboardingStatus) => void;
  setHydrating: (value: boolean) => void;
  logout: () => void;
}
