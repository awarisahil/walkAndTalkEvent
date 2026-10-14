import { z } from "zod";

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const createCommunityPostSchema = z
  .object({
    mediaType: z.enum(["PHOTO", "VIDEO", "INSTAGRAM"]),

    // PHOTO/VIDEO: either a file uploaded via /api/community/upload
    // ("/uploads/<file>") or an external media URL.
    // INSTAGRAM: must be an instagram.com post/reel link.
    mediaUrl: z.string().trim().min(1).max(1000),

    caption: z
      .string()
      .trim()
      .max(500, "Caption must not exceed 500 characters")
      .optional(),

    eventId: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mediaType === "INSTAGRAM") {
      if (
        !isHttpUrl(value.mediaUrl) ||
        !/instagram\.com\/(p|reel)\//i.test(value.mediaUrl)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["mediaUrl"],
          message:
            "Paste a full Instagram post or reel link (https://www.instagram.com/p/…)",
        });
      }
      return;
    }

    const isUploadedPath = /^\/uploads\/[\w.-]+$/.test(value.mediaUrl);
    if (!isUploadedPath && !isHttpUrl(value.mediaUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["mediaUrl"],
        message: "Upload a file or enter a full media URL",
      });
    }
  });

export const communityQuerySchema = z.object({
  eventId: z.string().trim().optional(),
  mediaType: z.enum(["PHOTO", "VIDEO", "INSTAGRAM"]).optional(),
});

export type CreateCommunityPostInput = z.infer<
  typeof createCommunityPostSchema
>;
