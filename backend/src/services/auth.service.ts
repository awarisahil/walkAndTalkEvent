import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma";
import { RegisterInput } from "../validators/auth.validator";
import { LoginInput } from "../validators/auth.validator";
import { generateAccessToken } from "../utils/jwt";
import { conflict, unauthorized } from "../utils/AppError";

function refreshTtlMs(): number {
  const days = Number(process.env.JWT_REFRESH_EXPIRES_IN ?? 30);
  return (
    (Number.isFinite(days) && days >= 1 && days <= 365 ? days : 30) *
    24 *
    60 *
    60 *
    1000
  );
}

function newRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const sessionUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  age: true,
  instagramUsername: true,
  instagramProfileUrl: true,
  role: true,
  createdAt: true,
} as const;

async function issueSession(userId: string, role: "ADMIN" | "CUSTOMER") {
  const accessToken = generateAccessToken({ userId, role });
  const refreshToken = newRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshTtlMs()),
    },
  });

  return { accessToken, refreshToken };
}

export async function registerUser(input: RegisterInput) {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  });

  if (existingUser) {
    throw conflict("User with this email already exists");
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
    select: sessionUserSelect,
  });

  const tokens = await issueSession(user.id, user.role);

  return { ...tokens, user };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  });

  if (!user) {
    throw unauthorized("Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.password,
  );

  if (!passwordMatches) {
    throw unauthorized("Invalid email or password");
  }

  const tokens = await issueSession(user.id, user.role);

  return {
    ...tokens,
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

/**
 * Rotates a refresh token: the presented token is revoked and a fresh
 * access + refresh pair is issued. Expired/revoked/unknown tokens force
 * a new login.
 */
export async function refreshSession(refreshToken: string) {
  const token = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) },
    include: { user: { select: sessionUserSelect } },
  });

  if (
    !token ||
    token.revokedAt !== null ||
    token.expiresAt.getTime() <= Date.now()
  ) {
    throw unauthorized("Session expired, please log in again");
  }

  const tokens = await issueSession(token.userId, token.user.role);

  await prisma.refreshToken.update({
    where: { id: token.id },
    data: { revokedAt: new Date() },
  });

  // Opportunistic cleanup of long-expired rows.
  prisma.refreshToken
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => undefined);

  return { ...tokens, user: token.user };
}

export async function logoutSession(refreshToken: string) {
  await prisma.refreshToken
    .updateMany({
      where: {
        tokenHash: hashRefreshToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    })
    .catch(() => undefined);
}
