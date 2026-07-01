import { useCallback, useState } from "react";
import { ApiError } from "@/src/shared/api-error";
import {
  deleteStaffMember,
  fetchStaffMembers,
  inviteStaffMember,
  resendStaffInvite,
  setPassword,
  updateStaffMember,
} from "../api/staff.api";
import type {
  InviteStaffPayload,
  SetPasswordPayload,
  StaffMember,
  UpdateStaffPayload,
} from "../types/staff.types";

function toApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError(0, "Something went wrong.");
}

export function useStaffList() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchStaffMembers();
      setStaff(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not load staff members.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { staff, isLoading, error, load };
}

export function useStaffMutations() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invite = useCallback(async (payload: InviteStaffPayload) => {
    setIsLoading(true);
    setError(null);
    try {
      return await inviteStaffMember(payload);
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError.message);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const update = useCallback(async (userId: string, payload: UpdateStaffPayload) => {
    setIsLoading(true);
    setError(null);
    try {
      return await updateStaffMember(userId, payload);
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError.message);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const remove = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      return await deleteStaffMember(userId);
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError.message);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resend = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      return await resendStaffInvite(userId);
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError.message);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (payload: SetPasswordPayload) => {
    setIsLoading(true);
    setError(null);
    try {
      return await setPassword(payload);
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError.message);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { invite, update, remove, resend, resetPassword, isLoading, error };
}
