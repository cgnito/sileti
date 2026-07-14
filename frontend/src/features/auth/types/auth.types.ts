// Shared auth/session types. Mirrors the backend's AuthContext shape
// (security.py) — there is no separate "admin user" anymore. A school's
// Organization row IS the admin account (school_email + hashed_password
// live directly on Organization). Staff members are separate User rows
// with role="staff". AuthContext.role is "admin" for the org-as-admin
// case, or the literal value of User.role (currently just "staff") for
// everyone else.

export type UserRole = "admin" | "staff";

/**
 * The logged-in principal. For an admin, `id` and `orgId` are the same
 * UUID (the Organization's own id doubles as the admin's identity).
 * `displayName` is the school's name for admins (school accounts have
 * no separate personal name — this is intentional, confirmed with the
 * team) or the staff member's full_name for staff.
 */
export interface SileteUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  orgId: string;
  isActive: boolean;
}

/**
 * Full org profile, as returned by GET /orgs/my-school. Login alone
 * only gives us orgId + role — fetch this separately when the UI needs
 * short_code, slug, or to confirm school_name beyond what's in the JWT.
 */
export interface SileteOrg {
  id: string;
  schoolName: string;
  shortCode: string;
  schoolEmail: string;
  slug: string | null;
}

/**
 * Onboarding status returned by GET /orgs/onboarding-status.
 * The backend payload uses the snake_case shape below.
 */
export interface OnboardingStepStatus {
  email_verified: boolean;
  bank_settlement: boolean;
  classes_created: boolean;
  students_added: boolean;
  fees_configured: boolean;
}

export interface OnboardingProgress {
  is_completed: boolean;
  steps: OnboardingStepStatus;
}

export interface AuthState {
  user: SileteUser | null;
  org: SileteOrg | null;
  // Change type from OnboardingStatus string to the progress shape or null
  onboardingProgress: OnboardingProgress | null; 
  accessToken: string | null;
  isHydrating: boolean;

  setSession: (params: {
    user: SileteUser;
    org?: SileteOrg | null;
    accessToken: string;
    onboardingProgress?: OnboardingProgress | null;
  }) => void;
  setOrg: (org: SileteOrg | null) => void;
  setOnboardingProgress: (progress: OnboardingProgress) => void;
  setHydrating: (value: boolean) => void;
  logout: () => void;
}