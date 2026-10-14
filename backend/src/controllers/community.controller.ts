import type { Request, Response } from "express";
import {
  createCommunityPostSchema,
  communityQuerySchema,
} from "../validators/community.validator";
import {
  createCommunityPost,
  deleteCommunityPost,
  listCommunityPosts,
} from "../services/community.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, unauthorized } from "../utils/AppError";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";

export const listCommunityPostsController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = communityQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw badRequest("Invalid query parameters", query.error.flatten());
    }

    const posts = await listCommunityPosts(query.data);

    return ok(res, posts);
  },
);

export const createCommunityPostController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw unauthorized();

    const validation = createCommunityPostSchema.safeParse(req.body);
    if (!validation.success) {
      throw badRequest("Invalid input", validation.error.flatten());
    }

    const post = await createCommunityPost(
      req.user.userId,
      validation.data,
    );

    return ok(res, post, {
      message: "Community post added",
      status: 201,
    });
  },
);

export const deleteCommunityPostController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const result = await deleteCommunityPost(String(req.params.id));

    return ok(res, result, { message: "Community post removed" });
  },
);
