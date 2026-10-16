import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma";
import { badRequest } from "../utils/AppError";
import { issueSession } from "./auth.service";
import {
  emailConfigured,
  sendLoginCodeEmail,
  sendPasswordResetOtp,
} from "./email.service";

export const OTP_PURPOSE = {
  PASSWORD_RESET: "PASSWORD_RESET",
  EMAIL_LOGIN: "EMAIL_LOGIN",
} as const;

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

async function createOtpForUser(
  userId: string,
  purpose: string,
): Promise<string> {
  const latest = await prisma.passwordResetOtp.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (
    latest &&
    Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    throw badRequest(
      "A code was already sent recently — please wait a minute before requesting another",
    );
  }

  const otp = generateOtp();

  await prisma.$transaction([
    prisma.passwordResetOtp.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.passwordResetOtp.create({
      data: {
        userId,
        purpose,
        codeHash: hashOtp(otp),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    }),
  ]);

  return otp;
}

async function consumeOtp(
  email: string,
  otp: string,
  purpose: string,
): Promise<{ id: string }> {
  const user = await prisma.user.findUnique({ where: { email } });

  const record = user
    ? await prisma.passwordResetOtp.findFirst({
        where: { userId: user.id, purpose, consumedAt: null },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const invalid = () =>
    badRequest(
      purpose === OTP_PURPOSE.EMAIL_LOGIN
        ? "Invalid or expired code"
        : "Invalid or expired reset code",
    );

  if (!user || !record) throw invalid();
  if (record.expiresAt.getTime() <= Date.now()) throw invalid();
  if (record.attempts >= MAX_ATTEMPTS)
    throw badRequest("Too many attempts — request a new code");

  if (record.codeHash !== hashOtp(otp.trim())) {
    await prisma.passwordResetOtp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw invalid();
  }

  await prisma.passwordResetOtp.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  return { id: user.id };
}

/**
 * Always resolves with the same generic message so the endpoint cannot be
 * used to enumerate registered email addresses.
 */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const otp = await createOtpForUser(user.id, OTP_PURPOSE.PASSWORD_RESET);
    await sendPasswordResetOtp(user.email, user.name, otp);
    if (!emailConfigured()) {
      console.warn(
        "SMTP not configured — OTP recorded but not emailed. Set SMTP_HOST/SMTP_USER/SMTP_PASS.",
      );
    }
  }

  return {
    message: "If an account exists for this email, a reset code has been sent",
  };
}

export async function resetPasswordWithOtp(input: {
  email: string;
  otp: string;
  newPassword: string;
}) {
  const { id: userId } = await consumeOtp(
    input.email,
    input.otp,
    OTP_PURPOSE.PASSWORD_RESET,
  );

  const hashedPassword = await bcrypt.hash(input.newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return {
    message: "Password updated — you can log in with your new password",
  };
}

/**
 * Passwordless login: a 6-digit code emailed to the address. No password
 * exists or is needed — email ownership IS the credential.
 */
export async function requestEmailLoginCode(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const otp = await createOtpForUser(user.id, OTP_PURPOSE.EMAIL_LOGIN);
    await sendLoginCodeEmail(user.email, user.name, otp);
  }

  return {
    message: "If an account exists for this email, a login code has been sent",
  };
}

export async function loginWithEmailCode(input: {
  email: string;
  otp: string;
}) {
  const { id: userId } = await consumeOtp(
    input.email,
    input.otp,
    OTP_PURPOSE.EMAIL_LOGIN,
  );

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  const tokens = await issueSession(userId, user?.role ?? "CUSTOMER");

  const fresh = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      age: true,
      instagramUsername: true,
      instagramProfileUrl: true,
      linkedinProfileUrl: true,
      role: true,
      createdAt: true,
    },
  });

  return { ...tokens, user: fresh };
}
