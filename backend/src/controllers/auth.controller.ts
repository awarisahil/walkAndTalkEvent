import type { Request, Response } from "express";
import { loginSchema, refreshSchema, registerSchema } from "../validators/auth.validator";
import {
  loginUser,
  logoutSession,
  refreshSession,
  registerUser,
} from "../services/auth.service";
import {
  requestPasswordReset,
  resetPasswordWithOtp,
} from "../services/passwordReset.service";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth.validator";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest } from "../utils/AppError";

export const register = asyncHandler(
  async (req: Request, res: Response) => {
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
      throw badRequest("Invalid input", result.error.flatten());
    }

    const user = await registerUser(result.data);

    return ok(res, user, {
      message: "Registration successful",
      status: 201,
    });
  },
);

export const login = asyncHandler(
  async (req: Request, res: Response) => {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
      throw badRequest("Invalid input", result.error.flatten());
    }

    const data = await loginUser(result.data);
    return ok(res, data, { message: "Login successful" });
  },
);

export const refresh = asyncHandler(
  async (req: Request, res: Response) => {
    const result = refreshSchema.safeParse(req.body);

    if (!result.success) {
      throw badRequest("Invalid input", result.error.flatten());
    }

    const data = await refreshSession(result.data.refreshToken);
    return ok(res, data, { message: "Session refreshed" });
  },
);

export const logout = asyncHandler(
  async (req: Request, res: Response) => {
    const result = refreshSchema.safeParse(req.body);

    if (result.success) {
      await logoutSession(result.data.refreshToken);
    }

    return ok(res, { loggedOut: true }, { message: "Logged out" });
  },
);

export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const result = forgotPasswordSchema.safeParse(req.body);

    if (!result.success) {
      throw badRequest("Invalid input", result.error.flatten());
    }

    const data = await requestPasswordReset(result.data.email);

    return ok(res, data);
  },
);

export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const result = resetPasswordSchema.safeParse(req.body);

    if (!result.success) {
      throw badRequest("Invalid input", result.error.flatten());
    }

    const data = await resetPasswordWithOtp(result.data);

    return ok(res, data);
  },
);
