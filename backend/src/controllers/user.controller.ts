import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import { updateProfileSchema } from "../validators/user.validator";
import {
  getUserProfile,
  updateUserProfile,
} from "../services/user.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, unauthorized } from "../utils/AppError";

export const getMeController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw unauthorized();

    const profile = await getUserProfile(req.user.userId);

    return ok(res, profile);
  },
);

export const updateMeController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw unauthorized();

    const result = updateProfileSchema.safeParse(req.body);

    if (!result.success) {
      throw badRequest("Invalid input", result.error.flatten());
    }

    const profile = await updateUserProfile(
      req.user.userId,
      result.data,
    );

    return ok(res, profile, { message: "Profile updated successfully" });
  },
);
