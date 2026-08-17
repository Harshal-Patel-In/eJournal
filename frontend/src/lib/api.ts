/**
 * Base API client utility for backend communication.
 *
 * RULE-FE08: Frontend NEVER makes direct database connections.
 * All data flows through authenticated backend APIs.
 */

declare global {
  interface Window {
    __IS_LOGGING_OUT?: boolean;
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/** Standard API error response shape */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/** Standard API response envelope */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
}

/** Custom error class for API failures */
export class ApiRequestError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Core fetch wrapper with response envelope handling.
 *
 * - Automatically parses the response envelope
 * - Throws ApiRequestError on failure responses
 * - Includes credentials for HTTP-only cookie auth (RULE-AUTH01)
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body: ApiResponse<T> = await response.json();

  if (!body.success || body.error) {
    // Force clear JWT cookie at root path if authentication is rejected (prevents Next.js loops)
    if (
      response.status === 401 ||
      body.error?.code === "UNAUTHORIZED" ||
      body.error?.code === "INVALID_TOKEN" ||
      body.error?.code === "USER_NOT_FOUND"
    ) {
      // Do not dispatch session expired modal if logging out, on auth pages, or root
      if (
        typeof window !== "undefined" &&
        !(window as any).__IS_LOGGING_OUT &&
        !endpoint.includes("/auth/logout") &&
        !window.location.pathname.startsWith("/auth") &&
        window.location.pathname !== "/"
      ) {
        window.dispatchEvent(new Event("unauthorized"));
      }
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
      } catch (err) {
        // Ignore logout network exceptions
      }
    }

    throw new ApiRequestError(
      body.error?.code || "UNKNOWN_ERROR",
      body.error?.message || "An unexpected error occurred",
      response.status,
      body.error?.details
    );
  }

  return body.data as T;
}

/** API client methods */
export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: "GET" }),

  post: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),
};
