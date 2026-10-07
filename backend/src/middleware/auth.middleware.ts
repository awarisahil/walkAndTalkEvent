import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

if (!JWT_ACCESS_SECRET) {
  throw new Error("JWT_ACCESS_SECRET is not configured");
}

const JWT_SECRET: string = JWT_ACCESS_SECRET;
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: "ADMIN" | "CUSTOMER";
  };
}

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authHeader.substring(7);
const decoded = jwt.verify(token, JWT_SECRET);

   if (
  typeof decoded !== "object" ||
  decoded === null ||
  !("userId" in decoded) ||
  !("role" in decoded) ||
  typeof decoded.userId !== "string" ||
  (decoded.role !== "ADMIN" && decoded.role !== "CUSTOMER")
) {
      return res.status(401).json({
        success: false,
        message: "Invalid access token",
      });
    }

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: "Access token expired",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid access token",
    });
  }
}