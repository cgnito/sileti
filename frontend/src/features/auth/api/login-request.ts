import { ApiError } from "@/src/shared/api-error";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Confirmed against the latest auth.py: login now checks the
 * Organization table first (school-as-admin), then falls back to the
 * User table (staff). Either way it returns role + org_id directly —
 * no separate /users/me call is needed just to know who logged in.
 */
export interface LoginTokenResponse {
  access_token: string;
  token_type: "bearer";
  role: "admin" | "staff";
  org_id: string;
}

/**
 * POST /auth/login takes application/x-www-form-urlencoded with a field
 * literally named `username` (FastAPI's OAuth2PasswordRequestForm),
 * even though the value we send is the user's email address. Kept
 * separate from apiClient since this is the one endpoint in the whole
 * API with a different request shape.
 */
export async function loginRequest(
  email: string,
  password: string
): Promise<LoginTokenResponse> {
  const formBody = new URLSearchParams();
  formBody.set("username", email); // field name is "username" per OAuth2PasswordRequestForm
  formBody.set("password", password);

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody.toString(),
  });

  if (!response.ok) {
    throw await ApiError.fromResponse(response);
  }

  return response.json();
}