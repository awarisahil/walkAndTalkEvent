import jwt from "jsonwebtoken";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

if (!JWT_ACCESS_SECRET) {
  throw new Error("JWT_ACCESS_SECRET is not configured");
}

export interface AccessTokenPayload {
  userId: string;
  role: "ADMIN" | "CUSTOMER";
}

export function generateAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: "15m",
  });
}