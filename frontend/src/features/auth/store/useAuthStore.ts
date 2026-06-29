import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { AuthState } from "../types/auth.types";

/**
 * Central session store. Holds whatever we know about the current
 * visitor: logged out, logged in but mid-onboarding, or logged in and
 * fully set up.
 *
 * `org` starts out null even right after login — POST /auth/login only
 * returns {access_token, token_type, role, org_id}, not the full org
 * profile. Call GET /orgs/my-school (see auth.api.ts) when the UI
 * actually needs school_name/short_code/slug, then setOrg() with the
 * result. Don't assume `org` is populated just because `user` is.
 *
 * Only the access token + minimal user/org shape are persisted to
 * localStorage. On app load, isHydrating stays true until a
 * auth.hooks.ts effect has had a chance to validate the token — branch
 * on `isHydrating` too, not just `user`, to avoid a flash of the
 * logged-out state before rehydration finishes.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      org: null,
      onboardingStatus: "incomplete",
      accessToken: null,
      isHydrating: true,

      setSession: ({ user, org, accessToken, onboardingStatus }) =>
        set({
          user,
          org: org ?? null,
          accessToken,
          onboardingStatus: onboardingStatus ?? "incomplete",
          isHydrating: false,
        }),

      setOrg: (org) => set({ org }),

      setOnboardingStatus: (status) => set({ onboardingStatus: status }),

      setHydrating: (value) => set({ isHydrating: value }),

      logout: () =>
        set({
          user: null,
          org: null,
          accessToken: null,
          onboardingStatus: "incomplete",
          isHydrating: false,
        }),
    }),
    {
      name: "sileti-auth",
      storage: createJSONStorage(() => localStorage),
      // Don't persist isHydrating — every fresh load should re-derive it.
      partialize: (state) => ({
        user: state.user,
        org: state.org,
        accessToken: state.accessToken,
        onboardingStatus: state.onboardingStatus,
      }),
    }
  )
);

/** Convenience selector: is anyone logged in at all? */
export const useIsAuthenticated = () =>
  useAuthStore((s) => Boolean(s.user && s.accessToken));