import client from "./client";
import type { AuthResponse, RegisterPayload, User } from "../types";

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

/** The axios response interceptor already returns the envelope; this unwraps `data`. */
export function unwrap<T>(envelope: unknown): T {
  const env = envelope as Envelope<T>;
  if (env && typeof env === "object" && "data" in env) {
    return env.data;
  }
  return envelope as T;
}

export async function loginApi(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await client.post("/auth/login", { email, password });
  return unwrap<AuthResponse>(res);
}

/** Rotates a refresh token into a fresh {accessToken, refreshToken, user} pair. */
export async function refreshSession(refreshToken: string): Promise<AuthResponse> {
  const res = await client.post("/auth/refresh", { refreshToken });
  return unwrap<AuthResponse>(res);
}

/** Revokes a refresh token. Idempotent — safe with an already-dead token. */
export async function logoutSession(refreshToken: string): Promise<void> {
  await client.post("/auth/logout", { refreshToken });
}

/**
 * Current backends return {accessToken, refreshToken, user} from register.
 * Older builds returned only the user record — for those, log in to obtain
 * the tokens.
 */
export async function registerApi(
  payload: RegisterPayload,
): Promise<AuthResponse> {
  const res = await client.post("/auth/register", payload);
  const data = unwrap<
    User & { accessToken?: unknown; refreshToken?: unknown; user?: unknown }
  >(res);

  if (
    typeof data.accessToken === "string" &&
    typeof data.refreshToken === "string" &&
    data.user &&
    typeof data.user === "object"
  ) {
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user as User,
    };
  }

  // Legacy shape: `data` is the user record itself, without tokens.
  return loginApi(payload.email, payload.password);
}
