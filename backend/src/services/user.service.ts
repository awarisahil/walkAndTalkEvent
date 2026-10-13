import prisma from "../config/prisma";
import { conflict, notFound } from "../utils/AppError";
import type { UpdateProfileInput } from "../validators/user.validator";

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  age: true,
  instagramUsername: true,
  instagramProfileUrl: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });

  if (!user) throw notFound("User not found");

  return user;
}

export async function updateUserProfile(
  userId: string,
  input: UpdateProfileInput,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) throw notFound("User not found");

  // Email changes must stay unique; role/password are never writable here
  // (mass-assignment guard — only explicitly listed fields are updated).
  if (input.email && input.email !== user.email) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw conflict("A user with this email already exists");
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.age !== undefined && { age: input.age }),
      ...(input.instagramUsername !== undefined && {
        instagramUsername: input.instagramUsername,
      }),
      ...(input.instagramProfileUrl !== undefined && {
        instagramProfileUrl: input.instagramProfileUrl,
      }),
    },
    select: publicUserSelect,
  });
}
