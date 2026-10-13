import axios, { AxiosError } from "axios";
import type { ApiErrorBody } from "../types";

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

interface StoredAuth {
  token: string;
  user: unknown;
}

export function readStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAuth>;
    if (typeof parsed.token !== "string") return null;
    return { token: parsed.token, user: parsed.user ?? null };
  } catch {
    return null;
  }
}

export function clearStoredAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:5000/api",
});

client.interceptors.request.use((config) => {
  const stored = readStoredAuth();
  if (stored?.token) {
    config.headers.Authorization = `Bearer ${stored.token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status;
    const body = error.response?.data;

    if (status === 401) {
      clearStoredAuth();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }

    const message =
      body && typeof body.message === "string" && body.message.length > 0
        ? body.message
        : error.message || "Something went wrong. Please try again.";

    return Promise.reject(new ApiError(message, status ?? 0));
  },
);

export default client;
