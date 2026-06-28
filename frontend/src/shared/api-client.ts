import { useAuthStore } from "../features/auth/store/useAuthStore";
import { ApiError } from "./api-error";

/**
 * Base URL for the FastAPI backend. Set NEXT_PUBLIC_API_URL in .env.local —
 * see .env.example. Falls back to localhost for local dev against the
 * teammate's backend running on the default FastAPI/uvicorn port.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type JsonBody = Record<string, unknown> | unknown[];

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: JsonBody;
  /** Set true for public endpoints (login, register, verify) to skip
   *  attaching an Authorization header even if a stale token exists. */
  skipAuth?: boolean;
  signal?: AbortSignal;
}

/**
 * Core JSON request helper. Handles:
 *  - Prefixing the API base URL
 *  - Attaching `Authorization: Bearer <token>` from the auth store
 *  - JSON-encoding the request body and parsing the JSON response
 *  - Normalizing errors into ApiError
 *  - Logging the user out on 401, since there is no refresh-token flow —
 *    a 401 here always means the session is dead, not just stale.
 *
 * This does NOT handle the login endpoint — that one needs
 * application/x-www-form-urlencoded with a `username` field instead of
 * JSON. Use `loginRequest` from `auth.api.ts` for that specifically.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, skipAuth = false, signal } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!skipAuth) {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    const error = await ApiError.fromResponse(response);

    if (error.isUnauthorized && !skipAuth) {
      // No refresh-token flow exists on this backend today — a 401 on an
      // authenticated request means the token is invalid/expired, full
      // stop. Clear the session so the rest of the app re-renders as
      // logged-out instead of silently retrying with a dead token.
      useAuthStore.getState().logout();
    }

    throw error;
  }

  // Some endpoints (e.g. DELETE /classes/{id}) return a plain message
  // object with no real content-type surprises, but guard against an
  // empty 204-style body just in case.
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: JsonBody, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", body }),

  patch: <T>(path: string, body?: JsonBody, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PATCH", body }),

  put: <T>(path: string, body?: JsonBody, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PUT", body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "DELETE" }),
};