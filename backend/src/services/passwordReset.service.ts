import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma";
import { badRequest } from "../utils/AppError";
import {
  emailConfigured,
  sendPasswordResetOtp,
} from "./email.service";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

function generateOtp(): string {
  // 6-digit zero-padded code from a CSPRNG
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Always resolves with the same generic message so the endpoint cannot be
 * used to enumerate registered email addresses.
 */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const latest = await prisma.passwordResetOtp.findFirst({
      where: { userId: user.id, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      throw badRequest(
        "A reset code was already sent recently — please wait a minute before requesting another",
      );
    }

    const otp = generateOtp();

    await prisma.$transaction([
      // Invalidate any previous unconsumed codes
      prisma.passwordResetOtp.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      prisma.passwordResetOtp.create({
        data: {
          userId: user.id,
          codeHash: hashOtp(otp),
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      }),
    ]);

    await sendPasswordResetOtp(user.email, user.name, otp);
    if (!emailConfigured()) {
      console.warn(
        "SMTP not configured — OTP recorded but not emailed. Set SMTP_HOST/SMTP_USER/SMTP_PASS.",
      );
    }
  }

  return {
    message:
      "If an account exists for this email, a reset code has been sent",
  };
}

export async function resetPasswordWithOtp(input: {
  email: string;
  otp: string;
  newPassword: string;
}) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  const record = user
    ? await prisma.passwordResetOtp.findFirst({
        where: { userId: user.id, consumedAt: null },
        orderBy: { createdAt: "desc" },
      })
    : null;

  // Uniform error so timing/shape can't distinguish bad email vs bad code
  const invalid = () => badRequest("Invalid or expired reset code");

  if (!user || !record) throw invalid();
  if (record.expiresAt.getTime() <= Date.now()) throw invalid();
  if (record.attempts >= MAX_ATTEMPTS)
    throw badRequest("Too many attempts — request a new code");

  if (record.codeHash !== hashOtp(input.otp.trim())) {
    await prisma.passwordResetOtp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw invalid();
  }

  const hashedPassword = await bcrypt.hash(input.newPassword, 12);

  await prisma.$transaction([
    prisma.passwordResetOtp.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    }),
    // Force re-login on every device
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return { message: "Password updated — you can log in with your new password" };
}
