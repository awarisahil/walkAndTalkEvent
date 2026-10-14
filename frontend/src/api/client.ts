import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import type { ApiErrorBody, AuthResponse } from "../types";

export const AUTH_STORAGE_KEY = "event_platform_auth";

/** Normalized error with the HTTP status attached (e.g. 409 for duplicate requests). */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  user: unknown;
}

/**
 * Reads the persisted session. Entries written before refresh tokens existed
 * have no refreshToken — they are treated as "no session" so the user is
 * asked to log in once, rather than crashing or half-authenticating.
 */
export function readStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAuth>;
    if (
      typeof parsed.accessToken !== "string" ||
      typeof parsed.refreshToken !== "string"
    ) {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      user: parsed.user ?? null,
    };
  } catch {
    return null;
  }
}

export function writeStoredAuth(auth: StoredAuth): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearStoredAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

const client = axios.create({ baseURL });

// Dedicated instance for the refresh call: no interceptors attached, so a
// failing refresh can never re-enter the 401 interceptor (no recursion).
const refreshClient = axios.create({ baseURL });

/** Auth endpoints must never trigger a refresh attempt themselves. */
const AUTH_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
]);

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Single-flight refresh: concurrent 401s share one /auth/refresh call. The
 * new token pair is persisted and the new access token returned; null when
 * the refresh failed or no refresh token exists.
 */
function refreshSessionOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const stored = readStoredAuth();
        if (!stored) return null;

        const res = await refreshClient.post("/auth/refresh", {
          refreshToken: stored.refreshToken,
        });
        const envelope = res.data as { success?: boolean; data?: AuthResponse };
        const data = envelope?.data ?? (res.data as AuthResponse);
        if (
          !data ||
          typeof data.accessToken !== "string" ||
          typeof data.refreshToken !== "string"
        ) {
          return null;
        }
        writeStoredAuth({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user ?? stored.user,
        });
        return data.accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

function forceLoginRedirect(): void {
  const path = window.location.pathname;
  if (path.startsWith("/login") || path.startsWith("/register")) return;
  window.location.assign("/login");
}

client.interceptors.request.use((config) => {
  const stored = readStoredAuth();
  if (stored?.accessToken) {
    config.headers.Authorization = `Bearer ${stored.accessToken}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status;
    let body: ApiErrorBody | undefined = error.response?.data;

    // Blob responses (e.g. CSV export) carry JSON error bodies inside the blob.
    if (body instanceof Blob) {
      try {
        body = JSON.parse(await body.text()) as ApiErrorBody;
      } catch {
        body = undefined;
      }
    }

    const config = error.config as RetryableConfig | undefined;
    const url = config?.url ?? "";
    const isAuthPath = AUTH_PATHS.has(url);

    if (status === 401 && config && !isAuthPath && !config._retried) {
      const newAccessToken = await refreshSessionOnce();

      if (newAccessToken) {
        // Retry the original request once with the new access token. The
        // retried response passes through this same interceptor, where its
        // _retried flag sends any further 401 straight to logout below.
        config._retried = true;
        config.headers.Authorization = `Bearer ${newAccessToken}`;
        return client(config);
      }

      // Refresh impossible or rejected: the session is dead.
      clearStoredAuth();
      forceLoginRedirect();
    } else if (status === 401 && !isAuthPath) {
      // 401 on a request that was already retried — never refresh-loop.
      clearStoredAuth();
      forceLoginRedirect();
    }
    // 401s on /auth/* (bad credentials, rejected refresh body) just surface
    // as normal errors to the caller.

    const message =
      body && typeof body.message === "string" && body.message.length > 0
        ? body.message
        : error.message || "Something went wrong. Please try again.";

    return Promise.reject(new ApiError(message, status ?? 0));
  },
);

export default client;
