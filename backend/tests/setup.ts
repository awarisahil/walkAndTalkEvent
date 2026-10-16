/**
 * Vitest setup — runs before EACH test file, before any application
 * module is imported.
 *
 * The dev DATABASE_URL (walkandtalk) is loaded via dotenv and ONLY its
 * database name is swapped to "walkandtalk_test". The credential values
 * are never printed or copied anywhere.
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { beforeAll } from "vitest";

const TEST_DB_NAME = "walkandtalk_test";

function computeTestDatabaseUrl(): string {
  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) {
    throw new Error("DATABASE_URL is not defined in backend/.env");
  }
  const url = new URL(devUrl);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL");
  }
  url.pathname = `/${TEST_DB_NAME}`;
  return url.toString();
}

const TEST_DATABASE_URL = computeTestDatabaseUrl();

// Point every downstream import (Prisma client, Express app, JWT utils)
// at the isolated test database BEFORE they are loaded.
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_ACCESS_SECRET ??= "test-secret";
process.env.NODE_ENV = "test";

// The test env has no Razorpay keys; make that explicit so the payments
// tests exercise the fail-closed paths even if the shell happens to
// export keys (razorpay.service reads these at import time).
delete process.env.RAZORPAY_KEY_ID;
delete process.env.RAZORPAY_KEY_SECRET;
delete process.env.RAZORPAY_WEBHOOK_SECRET;

// Never send real email from tests — even when the dev .env has SMTP
// configured. email.service falls back to its in-memory capture, which
// the OTP tests read via getLastMailForTests().
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

beforeAll(async () => {
  // Make sure the test database schema is fully migrated (no-op when
  // already up to date). Env override keeps the dev DB untouched.
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });

  const { default: prisma } = await import("../src/config/prisma");

  await prisma.$executeRawUnsafe(
    'TRUNCATE "Payment","Ticket","TicketRequest","Event","User" RESTART IDENTITY CASCADE',
  );

  return async () => {
    await prisma.$disconnect();
  };
});
