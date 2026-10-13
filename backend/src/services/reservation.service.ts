import type { PrismaClient } from "../generated/prisma/client";
import prisma from "../config/prisma";

/**
 * A reservation starts when an admin approves a ticket request
 * (status becomes PAYMENT_PENDING) and ends when:
 *  - the payment is fulfilled (status becomes PAID — the ticket now occupies the place), or
 *  - the reservation expires after PAYMENT_RESERVATION_MINUTES without payment, or
 *  - the request is cancelled/rejected before payment.
 *
 * Occupied places = requests in PAYMENT_PENDING (not expired) + PAID.
 */

type DbClient = Pick<PrismaClient, "ticketRequest" | "payment">;

export function reservationWindowMs(): number {
  const raw = Number(process.env.PAYMENT_RESERVATION_MINUTES ?? 30);
  const minutes =
    Number.isFinite(raw) && raw >= 1 && raw <= 24 * 60 ? raw : 30;
  return minutes * 60 * 1000;
}

export function reservationCutoff(): Date {
  return new Date(Date.now() - reservationWindowMs());
}

/**
 * Marks stale payment-pending requests as EXPIRED and their still-pending
 * payments as FAILED, releasing the reserved capacity.
 * Callers invoke this before capacity-sensitive reads/writes so counts
 * are always computed against a fresh state.
 */
export async function expireStaleReservations(
  client: DbClient = prisma,
  eventId?: string,
): Promise<number> {
  const stale = await client.ticketRequest.findMany({
    where: {
      status: "PAYMENT_PENDING",
      reviewedAt: { lt: reservationCutoff() },
      ...(eventId ? { eventId } : {}),
    },
    select: {
      id: true,
      payment: { select: { id: true, status: true } },
    },
  });

  for (const request of stale) {
    if (request.payment && request.payment.status === "PENDING") {
      await client.payment.update({
        where: { id: request.payment.id },
        data: { status: "FAILED" },
      });
    }

    await client.ticketRequest.update({
      where: { id: request.id },
      data: { status: "EXPIRED" },
    });
  }

  return stale.length;
}

/** Count places currently occupied for an event (must be called after
 *  expireStaleReservations for an accurate result). */
export async function countOccupiedPlaces(
  client: DbClient,
  eventId: string,
): Promise<number> {
  return client.ticketRequest.count({
    where: {
      eventId,
      status: { in: ["PAYMENT_PENDING", "PAID"] },
    },
  });
}
