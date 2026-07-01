import { apiClient } from "@/src/shared/api-client";
import { useAuthStore } from "../store/useAuthStore";
import { SileteUser, SileteOrg, OnboardingProgress } from "../types/auth.types";
import { loginRequest } from "./login-request";

// ── Login ───────────────────────────────────────────────────────────

/**
 * Logs the user in and populates the auth store.
 *
 * Unlike the previous backend version, POST /auth/login now returns
 * role + org_id directly, so we don't need a follow-up call just to
 * know who's logged in. For an admin, the backend's AuthContext sets
 * full_name = org.school_name (school accounts have no separate
 * personal name — confirmed intentional). We don't have that name yet
 * right after login though, since the login response itself doesn't
 * carry it — `displayName` is filled with the email as a placeholder
 * until fetchMySchool() resolves the real school name[cite: 20].
 */
export async function login(email: string, password: string): Promise<SileteUser> {
  const { access_token, role, org_id } = await loginRequest(email, password);

  const user: SileteUser = {
    id: org_id, // for admins, org id IS the identity id (AuthContext.id == org.id)
    email,
    displayName: email, // placeholder until fetchMySchool() resolves school_name[cite: 20]
    role,
    orgId: org_id,
    isActive: true,
  };

  useAuthStore.getState().setSession({
    user,
    org: null,
    accessToken: access_token,
    onboardingProgress: null, // Initialized as null until fetched via fetchOnboardingStatus()
  });

  return user;
}

// ── Fetch full org profile (school_name, short_code, slug) ─────────

interface OrgResponseDto {
  id: string;
  school_name: string;
  short_code: string;
  school_email: string;
  slug: string | null;
}

/**
 * GET /orgs/my-school — admin-only[cite: 20]. Use this after login when the UI
 * needs the school's display name, short_code, or slug, none of which
 * are in the login response[cite: 20]. Also backfills `user.displayName` with
 * the real school name once it resolves[cite: 20].
 *
 * Will 403 if called for a staff-role user (allow_admin_only on the
 * backend) — only call this when user.role === "admin"[cite: 20].
 */
export async function fetchMySchool(): Promise<SileteOrg> {
  const dto = await apiClient.get<OrgResponseDto>("/orgs/my-school");

  const org: SileteOrg = {
    id: dto.id,
    schoolName: dto.school_name,
    shortCode: dto.short_code,
    schoolEmail: dto.school_email,
    slug: dto.slug,
  };

  const { user, setOrg, setSession, accessToken, onboardingProgress } = useAuthStore.getState();
  setOrg(org);
  if (user && accessToken) {
    setSession({
      user: { ...user, displayName: org.schoolName },
      org,
      accessToken,
      onboardingProgress,
    });
  }

  return org;
}

// ── Fetch Granular Onboarding Progress Step Flags ──────────────────

/**
 * GET /orgs/onboarding-status — admin-only[cite: 20]. Pulls down the explicit completion 
 * checkpoints for the school deployment wizard loops (profile, academic arms, payouts, fees)[cite: 10, 11, 12, 14].
 * Updates store status inline so application route guards can pivot users reactively.
 */
export async function fetchOnboardingStatus(): Promise<OnboardingProgress> {
  const progress = await apiClient.get<OnboardingProgress>("/orgs/onboarding-status");

  const { setOnboardingProgress } = useAuthStore.getState();
  setOnboardingProgress(progress);

  return progress;
}

// ── Register (school signup) ────────────────────────────────────────

export interface RegisterInput {
  schoolName: string;
  shortCode?: string;
  schoolEmail: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
  role: "admin";
  org_id: string;
}

/**
 * Maps our camelCase form fields onto the current OrgCreate shape:
 * school_name, short_code (optional — server auto-generates one from
 * the school name if omitted), school_email, password. No admin name
 * field exists on this schema at all (confirmed intentional).
 */
export async function register(input: RegisterInput): Promise<RegisterResponse> {
  return apiClient.post<RegisterResponse>(
    "/orgs",
    {
      school_name: input.schoolName,
      short_code: input.shortCode || undefined,
      school_email: input.schoolEmail,
      password: input.password,
    },
    { skipAuth: true }
  );
}

// ── Email verification ─────────────────────────────────────────────

export interface VerifyResponse {
  message: string;
}

export async function verifyEmail(token: string): Promise<VerifyResponse> {
  return apiClient.get<VerifyResponse>(`/verify?token=${encodeURIComponent(token)}`, {
    skipAuth: true,
  });
}

export interface ResendVerificationResponse {
  message: string;
}

/**
 * NOTE: path changed in the latest backend read — it's now
 * POST /auth/resend-verification (previously POST
 * /resend-verification, no /auth prefix)[cite: 22]. Also: this version of the
 * endpoint only checks the Organization table, so it has no effect for
 * a staff account that hasn't set their password yet — that flow is
 * users.py's invite/resend-invite endpoints instead, not this one.
 */
export async function resendVerificationEmail(
  email: string
): Promise<ResendVerificationResponse> {
  return apiClient.post<ResendVerificationResponse>(
    "/auth/resend-verification",
    { email },
    { skipAuth: true }
  );
}

// ── Logout ──────────────────────────────────────────────────────────

export function logout() {
  useAuthStore.getState().logout();
}