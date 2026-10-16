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

export function sendLoginCodeEmail(
  to: string,
  name: string,
  otp: string,
): Promise<void> {
  const subject = "Your Walk & Talk Events login code";
  const text =
    `Hi ${name},\n\n` +
    `Your login code is: ${otp}\n\n` +
    `It expires in 10 minutes. If you did not request this, you can ignore this email.\n\n` +
    `— Walk & Talk Events`;

  return sendMail({
    to,
    subject,
    text,
    html:
      `<p>Hi ${name},</p>` +
      `<p>Your login code is:</p>` +
      `<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p>` +
      `<p>It expires in 10 minutes. If you did not request this, you can ignore this email.</p>` +
      `<p>— Walk & Talk Events</p>`,
  });
}

export function sendApprovalEmail(
  to: string,
  name: string,
  eventTitle: string,
  eventUrl: string,
  options?: { devPayLink?: string },
): Promise<void> {
  const subject = `You're approved for ${eventTitle} — complete your payment`;
  const text =
    `Hi ${name},\n\n` +
    `Great news — your request to join "${eventTitle}" has been approved!\n\n` +
    `Your spot is held for 30 minutes. Open the event page on the same browser/device where you requested to complete your payment:\n` +
    `${eventUrl}\n\n` +
    (options?.devPayLink
      ? `(dev) direct payment link: ${options.devPayLink}\n`
      : "") +
    `— Walk & Talk Events`;

  return sendMail({
    to,
    subject,
    text,
    html:
      `<p>Hi ${name},</p>` +
      `<p>Great news — your request to join <strong>${eventTitle}</strong> has been approved!</p>` +
      `<p>Your spot is held for 30 minutes. Open the event page on the <strong>same browser/device</strong> where you requested — your payment will be waiting there:</p>` +
      `<p><a href="${eventUrl}" style="display:inline-block;padding:12px 22px;background:#795548;color:#fff;border-radius:8px;text-decoration:none">Open the event</a></p>` +
      `<p style="word-break:break-all"><a href="${eventUrl}">${eventUrl}</a></p>` +
      (options?.devPayLink
        ? `<p style="color:#888;font-size:12px">(dev) direct payment link: <a href="${options.devPayLink}">${options.devPayLink}</a></p>`
        : "") +
      `<p>— Walk & Talk Events</p>`,
  });
}

export function sendCongratulationsEmail(
  to: string,
  name: string,
  eventTitle: string,
  ticketNumber: string,
  ticketUrl: string,
): Promise<void> {
  const subject = `🎉 You're in! Your ticket for ${eventTitle}`;
  const text =
    `Hi ${name},\n\n` +
    `Congratulations — your payment for "${eventTitle}" is confirmed.\n\n` +
    `Your ticket number: ${ticketNumber}\n\n` +
    `View your QR ticket here (no login needed — you can forward this email or link to anyone):\n` +
    `${ticketUrl}\n\n` +
    `Show the QR code at the venue entrance. See you there!\n\n` +
    `— Walk & Talk Events`;

  return sendMail({
    to,
    subject,
    text,
    html:
      `<p>Hi ${name},</p>` +
      `<p>Congratulations — your payment for <strong>${eventTitle}</strong> is confirmed.</p>` +
      `<p>Your ticket number: <strong>${ticketNumber}</strong></p>` +
      `<p>View your QR ticket here — <strong>no login needed</strong>, and you can forward this email or link to anyone:</p>` +
      `<p><a href="${ticketUrl}" style="display:inline-block;padding:12px 22px;background:#526B4F;color:#fff;border-radius:8px;text-decoration:none">View ticket</a></p>` +
      `<p style="word-break:break-all"><a href="${ticketUrl}">${ticketUrl}</a></p>` +
      `<p>Show the QR code at the venue entrance. See you there!</p>` +
      `<p>— Walk & Talk Events</p>`,
  });
}
