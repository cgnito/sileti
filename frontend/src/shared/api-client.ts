import { useAuthStore } from "../features/auth/store/useAuthStore";
import { ApiError } from "./api-error";

/**
 * Base URL for the FastAPI backend. Set NEXT_PUBLIC_API_URL in .env.local.
 * Falls back to localhost for local dev against uvicorn's default port.
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
 *  - Logging the user out on 401, since there is no refresh-token flow
 *    on this backend — a 401 here always means the session is dead.
 *
 * Does NOT handle POST /auth/login — that endpoint takes
 * application/x-www-form-urlencoded with a `username` field instead of
 * JSON. Use `loginRequest` from `login-request.ts` for that.
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
      useAuthStore.getState().logout();
    }

    throw error;
  }

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