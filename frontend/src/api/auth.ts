import client from "./client";
import type { AuthResponse, RegisterPayload } from "../types";

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

/** The API's register endpoint returns only the user — a login call follows to obtain the token. */
export async function registerApi(
  payload: RegisterPayload,
): Promise<AuthResponse> {
  await client.post("/auth/register", payload);
  return loginApi(payload.email, payload.password);
}
