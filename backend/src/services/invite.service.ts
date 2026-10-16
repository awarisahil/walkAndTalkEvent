import crypto from "node:crypto";
import prisma from "../config/prisma";
import { notFound, unauthorized } from "../utils/AppError";
import { reservationCutoff } from "./reservation.service";

const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function inviteTtlMs(): number {
  return INVITE_TTL_MS;
}

export function newInviteToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Creates (or replaces) the payment invite for an approved request. */
export async function createInviteForRequest(ticketRequestId: string) {
  const token = newInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await prisma.approvalInvite.upsert({
    where: { ticketRequestId },
    update: { tokenHash: hashInviteToken(token), expiresAt },
    create: { ticketRequestId, tokenHash: hashInviteToken(token), expiresAt },
  });

  return token;
}

/**
 * Returns the existing valid invite for a request, creating one only when
 * missing or expired. Returns the RAW token when freshly created, or null
 * when an invite already exists (its raw token lives with the browser that
 * requested — we only store the hash).
 */
export async function ensureInviteForRequest(
  ticketRequestId: string,
): Promise<{ freshToken: string | null }> {
  const existing = await prisma.approvalInvite.findUnique({
    where: { ticketRequestId },
  });

  if (existing && existing.expiresAt.getTime() > Date.now()) {
    return { freshToken: null };
  }

  return { freshToken: await createInviteForRequest(ticketRequestId) };
}

const inviteStateSelect = {
  id: true,
  expiresAt: true,
  ticketRequest: {
    select: {
      id: true,
      status: true,
      rejectionReason: true,
      reviewedAt: true,
      user: {
        select: {
          name: true,
          email: true,
          instagramUsername: true,
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          date: true,
          startTime: true,
          endTime: true,
          venue: true,
          ticketPrice: true,
        },
      },
      payment: {
        select: { id: true, status: true, amount: true, providerOrderId: true },
      },
      ticket: {
        select: { id: true, ticketNumber: true, status: true, qrCode: true, usedAt: true },
      },
    },
  },
} as const;

export async function getInviteState(token: string) {
  const invite = await prisma.approvalInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: inviteStateSelect,
  });

  if (!invite) throw notFound("Link not found or no longer valid");
  if (invite.expiresAt.getTime() <= Date.now()) {
    throw unauthorized("This link has expired — please contact the organizer");
  }

  const request = invite.ticketRequest;
  const reservationValid =
    request.status === "PAYMENT_PENDING" &&
    request.reviewedAt !== null &&
    request.reviewedAt >= reservationCutoff();

  return {
    expiresAt: invite.expiresAt,
    requestId: request.id,
    status: request.status,
    reservationValid,
    rejectionReason: request.rejectionReason,
    attendee: request.user,
    event: request.event,
    payment: request.payment,
    ticket: request.ticket,
  };
}

/** Loads the invite + request id for mutating calls (pay/verify). */
export async function getInviteRequestId(token: string): Promise<string> {
  const state = await getInviteState(token);
  return state.requestId;
}
