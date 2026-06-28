import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthState } from "@/src/features/auth/types/auth.types";

/**
 * Central session store. Holds whatever we know about the current
 * visitor: logged out, logged in but mid-onboarding, or logged in
 * and fully set up.
 *
 * Only the access token + minimal user/org shape are persisted to
 * localStorage. On app load, isHydrating stays true until a
 * (future) auth.hooks.ts effect has had a chance to validate the
 * token against GET /users/me — components that branch on `user`
 * should also check `isHydrating` to avoid a flash of the logged-out
 * state before rehydration finishes.
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
          org,
          accessToken,
          onboardingStatus: onboardingStatus ?? "incomplete",
          isHydrating: false,
        }),

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
