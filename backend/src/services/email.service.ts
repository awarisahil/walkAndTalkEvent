import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM =
  process.env.SMTP_FROM ??
  (SMTP_USER ? `Walk & Talk Events <${SMTP_USER}>` : "Walk & Talk Events");

let transporter: Transporter | null = null;

/** In-memory capture of the last mail — used when no SMTP is configured
 * outside production (e.g. tests and local development). */
let lastMail: { to: string; subject: string; text: string } | null = null;

export function emailConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

function getTransporter(): Transporter | null {
  if (!emailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const transport = getTransporter();

  if (!transport) {
    lastMail = { to: options.to, subject: options.subject, text: options.text };
    if (process.env.NODE_ENV === "production") {
      console.warn(
        `SMTP is not configured — password reset email to ${options.to} was NOT sent.`,
      );
    } else {
      console.log(`[dev email] to=${options.to}\n${options.text}`);
    }
    return;
  }

  await transport.sendMail({
    from: MAIL_FROM,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
}

/** Test/dev helper: read the most recently "sent" mail when SMTP is off. */
export function getLastMailForTests() {
  return lastMail;
}

export function sendPasswordResetOtp(
  to: string,
  name: string,
  otp: string,
): Promise<void> {
  const subject = "Your Walk & Talk Events password reset code";
  const text =
    `Hi ${name},\n\n` +
    `Your password reset code is: ${otp}\n\n` +
    `It expires in 10 minutes. If you did not request this, you can ignore this email.\n\n` +
    `— Walk & Talk Events`;

  return sendMail({
    to,
    subject,
    text,
    html:
      `<p>Hi ${name},</p>` +
      `<p>Your password reset code is:</p>` +
      `<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p>` +
      `<p>It expires in 10 minutes. If you did not request this, you can ignore this email.</p>` +
      `<p>— Walk & Talk Events</p>`,
  });
}
