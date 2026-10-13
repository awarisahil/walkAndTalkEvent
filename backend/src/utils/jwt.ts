import jwt from "jsonwebtoken";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

if (!JWT_ACCESS_SECRET) {
  throw new Error("JWT_ACCESS_SECRET is not configured");
}

const JWT_SECRET: string = JWT_ACCESS_SECRET;

const rawExpiry = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
const expiresIn: number | `${number}${"s" | "m" | "h" | "d"}` =
  /^\d+$/.test(rawExpiry)
    ? Number(rawExpiry)
    : (rawExpiry as `${number}${"s" | "m" | "h" | "d"}`);

export interface AccessTokenPayload {
  userId: string;
  role: "ADMIN" | "CUSTOMER";
}

export function generateAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}
