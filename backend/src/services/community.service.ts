import prisma from "../config/prisma";
import { notFound } from "../utils/AppError";
import type { CreateCommunityPostInput } from "../validators/community.validator";

const communityPostSelect = {
  id: true,
  mediaType: true,
  mediaUrl: true,
  caption: true,
  createdAt: true,
  event: {
    select: { id: true, title: true, date: true, venue: true },
  },
} as const;

export async function listCommunityPosts(query: {
  eventId?: string;
  mediaType?: "PHOTO" | "VIDEO" | "INSTAGRAM";
}) {
  return prisma.communityPost.findMany({
    where: {
      ...(query.eventId ? { eventId: query.eventId } : {}),
      ...(query.mediaType ? { mediaType: query.mediaType } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: communityPostSelect,
  });
}

export async function createCommunityPost(
  adminId: string,
  input: CreateCommunityPostInput,
) {
  if (input.eventId) {
    const event = await prisma.event.findUnique({
      where: { id: input.eventId },
      select: { id: true },
    });
    if (!event) throw notFound("Event not found");
  }

  return prisma.communityPost.create({
    data: {
      mediaType: input.mediaType,
      mediaUrl: input.mediaUrl,
      caption: input.caption,
      eventId: input.eventId ?? null,
      addedById: adminId,
    },
    select: communityPostSelect,
  });
}

export async function deleteCommunityPost(postId: string) {
  const existing = await prisma.communityPost.findUnique({
    where: { id: postId },
    select: { id: true },
  });
  if (!existing) throw notFound("Community post not found");

  await prisma.communityPost.delete({ where: { id: postId } });
  return { id: postId };
}
