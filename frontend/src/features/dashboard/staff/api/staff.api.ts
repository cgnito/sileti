import { apiClient } from "@/src/shared/api-client";
import type {
  InviteStaffPayload,
  SetPasswordPayload,
  StaffMember,
  UpdateStaffPayload,
} from "../types/staff.types";

export async function fetchStaffMembers(): Promise<StaffMember[]> {
  return apiClient.get<StaffMember[]>("/users/staff");
}

export async function inviteStaffMember(payload: InviteStaffPayload): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/users/staff', payload as object);
}

export async function updateStaffMember(
  userId: string,
  payload: UpdateStaffPayload,
): Promise<StaffMember> {
  return apiClient.patch<StaffMember>(`/users/staff/${userId}`, payload as object);
}

export async function deleteStaffMember(userId: string): Promise<{ message: string }> {
  return apiClient.delete<{ message: string }>(`/users/staff/${userId}`);
}

export async function resendStaffInvite(userId: string): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>(`/users/staff/${userId}/resend-invite`);
}

export async function setPassword(payload: SetPasswordPayload): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/users/set-password', payload as object);
}
