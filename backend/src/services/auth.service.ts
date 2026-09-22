import bcrypt from "bcryptjs";
import prisma from "../config/prisma";
import { RegisterInput } from "../validators/auth.validator";
import { LoginInput } from "../validators/auth.validator";
import { generateAccessToken } from "../utils/jwt";
export async function registerUser(input: RegisterInput) {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  });

  if (existingUser) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      age: input.age,
      instagramUsername: input.instagramUsername,
      instagramProfileUrl: input.instagramProfileUrl,
      password: hashedPassword,
      role: "CUSTOMER",
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      age: true,
      instagramUsername: true,
      instagramProfileUrl: true,
      role: true,
      createdAt: true,
    },
  });

  return user;
}
export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.password,
  );

  if (!passwordMatches) {
    throw new Error("Invalid email or password");
  }

  const accessToken = generateAccessToken({
    userId: user.id,
    role: user.role,
  });

  return {
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      age: user.age,
      instagramUsername: user.instagramUsername,
      instagramProfileUrl: user.instagramProfileUrl,
      role: user.role,
      createdAt: user.createdAt,
    },
  };
}