export interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface InviteStaffPayload {
  full_name: string;
  email: string;
  role: string;
}

export interface UpdateStaffPayload {
  full_name: string;
  email: string;
}

export interface SetPasswordPayload {
  token: string;
  new_password: string;
}
