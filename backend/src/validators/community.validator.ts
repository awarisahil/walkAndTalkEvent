import { z } from "zod";

export const createCommunityPostSchema = z.object({
  mediaType: z.enum(["PHOTO", "VIDEO", "INSTAGRAM"]),
  mediaUrl: z
    .string()
    .trim()
    .url("Enter a full URL starting with http:// or https://")
    .max(1000),
  caption: z
    .string()
    .trim()
    .max(500, "Caption must not exceed 500 characters")
    .optional(),
  eventId: z.string().trim().min(1).optional(),
});

export const communityQuerySchema = z.object({
  eventId: z.string().trim().optional(),
  mediaType: z.enum(["PHOTO", "VIDEO", "INSTAGRAM"]).optional(),
});

export type CreateCommunityPostInput = z.infer<
  typeof createCommunityPostSchema
>;
