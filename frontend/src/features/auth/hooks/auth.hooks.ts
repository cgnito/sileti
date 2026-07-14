import { useState, useCallback } from "react";
import { ApiError } from "@/src/shared/api-error";
import {
  login as loginApi,
  register as registerApi,
  verifyEmail as verifyEmailApi,
  resendVerificationEmail as resendVerificationEmailApi,
  fetchMySchool as fetchMySchoolApi,
  fetchOnboardingStatus as fetchOnboardingStatusApi, // New granular checkpoint api method
  type RegisterInput,
} from "../api/auth.api";

function toApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError(0, "Something went wrong. Try again.");
}

export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      return await loginApi(email, password);
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { login: run, isLoading, error, clearError: () => setError(null) };
}

export function useRegister() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = useCallback(async (input: RegisterInput) => {
    setIsLoading(true);
    setError(null);
    try {
      return await registerApi(input);
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { register: run, isLoading, error, clearError: () => setError(null) };
}

export function useVerifyEmail() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = useCallback(async (token: string) => {
    setIsLoading(true);
    setError(null);
    try {
      return await verifyEmailApi(token);
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { verifyEmail: run, isLoading, error };
}

export function useResendVerification() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [sent, setSent] = useState(false);

  const run = useCallback(async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await resendVerificationEmailApi(email);
      setSent(true);
      return result;
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { resend: run, isLoading, error, sent };
}

/**
 * Fetches the full school profile (school_name, short_code, slug) via
 * GET /orgs/my-school. Admin-only on the backend — don't call this for
 * a staff-role session, it'll 403.
 */
export function useFetchMySchool() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      return await fetchMySchoolApi();
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { fetchMySchool: run, isLoading, error };
}

/**
 * Fetches the detailed granular step checkpoints for the school deployment wizard loops
 * (profile, academic arms, payouts, fees) via GET /orgs/onboarding-status.
 * Admin-only on the backend.
 */
export function useFetchOnboardingStatus() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      return await fetchOnboardingStatusApi();
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { fetchOnboardingStatus: run, isLoading, error };
}