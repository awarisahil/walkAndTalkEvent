import jwt from "jsonwebtoken";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

if (!JWT_ACCESS_SECRET) {
  throw new Error("JWT_ACCESS_SECRET is not configured");
}

const JWT_SECRET: string = JWT_ACCESS_SECRET;

/**
 * Accepts seconds ("900") or a timespan ("15m", "12h", "7d").
 * Empty or malformed values fall back to 15 minutes so a half-configured
 * .env can never break authentication at runtime.
 */
const rawExpiry = (process.env.JWT_ACCESS_EXPIRES_IN ?? "").trim();
const expiresIn: number | string = /^\d+$/.test(rawExpiry)
  ? Number(rawExpiry)
  : /^\d+\s*[smhd]$/.test(rawExpiry)
    ? rawExpiry.replace(/\s+/g, "")
    : "15m";

export interface AccessTokenPayload {
  userId: string;
  role: "ADMIN" | "CUSTOMER";
}

export function generateAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
  });
}
