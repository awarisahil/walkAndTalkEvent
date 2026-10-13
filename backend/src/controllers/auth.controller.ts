import type { Request, Response } from "express";
import { loginSchema, registerSchema } from "../validators/auth.validator";
import { loginUser, registerUser } from "../services/auth.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, unauthorized } from "../utils/AppError";

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

    try {
      const data = await loginUser(result.data);
      return ok(res, data, { message: "Login successful" });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Invalid email or password"
      ) {
        throw unauthorized(error.message);
      }
      throw error;
    }
  },
);
