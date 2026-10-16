import { Prisma } from "../generated/prisma/client";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from "../utils/AppError";
import type { PagedResult, Pagination } from "../utils/response";
import { paged } from "../utils/response";
import {
  countOccupiedPlaces,
  expireStaleReservations,
  reservationCutoff,
} from "./reservation.service";
import type { CreateTicketRequestInput } from "../validators/ticketRequest.validator";
import type { GuestJoinInput } from "../validators/guestJoin.validator";
import {
  createInviteForRequest,
  ensureInviteForRequest,
} from "./invite.service";
import { sendApprovalEmail } from "./email.service";

export function publicAppUrl(): string {
  return (
    (process.env.PUBLIC_APP_URL ?? "").replace(/\/+$/, "") ||
    "http://localhost:5173"
  );
}

const customerProfileSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  age: true,
  instagramUsername: true,
  instagramProfileUrl: true,
  linkedinProfileUrl: true,
} satisfies Prisma.UserSelect;

export async function createTicketRequest(
  userId: string,
  input: CreateTicketRequestInput,
) {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { id: true, status: true },
  });

  if (!event) throw notFound("Event not found");

  if (event.status !== "PUBLISHED") {
    throw badRequest(
      "Tickets can only be requested for published events",
    );
  }

  const existingRequest = await prisma.ticketRequest.findUnique({
    where: {
      userId_eventId: { userId, eventId: input.eventId },
    },
    select: { status: true },
  });

  if (existingRequest) {
    throw conflict(
      "You have already requested a ticket for this event",
    );
  }

  const ticketRequest = await prisma.ticketRequest.create({
    data: {
      userId,
      eventId: input.eventId,
      status: "PENDING",
    },
    select: {
      id: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
      event: {
        select: {
          id: true,
          title: true,
          date: true,
          venue: true,
          ticketPrice: true,
        },
      },
    },
  });

  return ticketRequest;
}

/**
 * Luma-style guest join: no signup, no login. The visitor's profile is
 * captured in the form; we silently create an account with a random
 * password on first use (claimable later via forgot-password), or refresh
 * the profile of an existing account, then file the ticket request.
 */
export async function requestToJoinAsGuest(input: GuestJoinInput) {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { id: true, status: true, title: true },
  });

  if (!event) throw notFound("Event not found");

  if (event.status !== "PUBLISHED") {
    throw badRequest("Tickets can only be requested for published events");
  }

  const profile = {
    name: input.name,
    phone: input.phone,
    age: input.age,
    instagramUsername: input.instagramUsername,
    instagramProfileUrl: input.instagramProfileUrl
      ? input.instagramProfileUrl
      : (`https://instagram.com/${input.instagramUsername}` as const),
    linkedinProfileUrl: input.linkedinProfileUrl ?? null,
  };

  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: profile,
    create: {
      ...profile,
      email: input.email,
      // Random password — the account is claimable later via the
      // forgot-password flow if the customer ever wants to log in.
      password: await bcrypt.hash(crypto.randomBytes(24).toString("base64url"), 12),
      role: "CUSTOMER",
    },
    select: { id: true },
  });

  const existingRequest = await prisma.ticketRequest.findUnique({
    where: { userId_eventId: { userId: user.id, eventId: input.eventId } },
    select: { id: true },
  });

  if (existingRequest) {
    // Same person, same event. Keep the ORIGINAL browser's token valid —
    // we only store hashes, so an existing invite cannot be re-shared with
    // a new device. The response tells the frontend "already requested".
    const { freshToken } = await ensureInviteForRequest(existingRequest.id);
    return {
      request: { id: existingRequest.id, status: "EXISTS" as const },
      eventTitle: event.title,
      inviteToken: freshToken,
      alreadyExists: true,
    };
  }

  const ticketRequest = await prisma.ticketRequest.create({
    data: { userId: user.id, eventId: input.eventId, status: "PENDING" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      event: { select: { id: true, title: true, date: true, venue: true } },
    },
  });

  // The requesting browser holds this token in localStorage — it's how the
  // event page recognizes "this machine" when the approval comes through.
  const inviteToken = await createInviteForRequest(ticketRequest.id);

  return {
    request: ticketRequest,
    eventTitle: event.title,
    inviteToken,
    alreadyExists: false,
  };
}

export interface AdminRequestQuery {
  search?: string;
  eventId?: string;
  status?:
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "PAYMENT_PENDING"
    | "PAID"
    | "CANCELLED"
    | "EXPIRED";
  dateFrom?: string;
  dateTo?: string;
}

export async function getTicketRequestsForAdmin(
  query: AdminRequestQuery,
  pagination: Pagination,
): Promise<PagedResult<unknown>> {
  await expireStaleReservations();

  const where: Prisma.TicketRequestWhereInput = {};

  if (query.status) where.status = query.status;
  if (query.eventId) where.eventId = query.eventId;

  if (query.search) {
    where.user = {
      OR: [
        { name: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ],
    };
  }

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {};
    if (query.dateFrom) {
      const from = new Date(query.dateFrom);
      if (Number.isNaN(from.getTime())) {
        throw badRequest("Invalid dateFrom value");
      }
      where.createdAt.gte = from;
    }
    if (query.dateTo) {
      const to = new Date(query.dateTo);
      if (Number.isNaN(to.getTime())) {
        throw badRequest("Invalid dateTo value");
      }
      where.createdAt.lte = to;
    }
  }

  const total = await prisma.ticketRequest.count({ where });

  const requests = await prisma.ticketRequest.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
    select: {
      id: true,
      status: true,
      rejectionReason: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
      user: { select: customerProfileSelect },
      event: {
        select: {
          id: true,
          title: true,
          date: true,
          venue: true,
          ticketPrice: true,
          capacity: true,
          status: true,
        },
      },
      payment: {
        select: { id: true, status: true, amount: true },
      },
      ticket: { select: { id: true, ticketNumber: true, status: true } },
    },
  });

  return paged(requests, total, pagination);
}

export async function getTicketRequestById(
  requesterId: string,
  requesterRole: "ADMIN" | "CUSTOMER",
  ticketRequestId: string,
) {
  const request = await prisma.ticketRequest.findUnique({
    where: { id: ticketRequestId },
    select: {
      id: true,
      status: true,
      rejectionReason: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
      user: { select: customerProfileSelect },
      event: {
        select: {
          id: true,
          title: true,
          description: true,
          image: true,
          date: true,
          startTime: true,
          endTime: true,
          venue: true,
          ticketPrice: true,
          capacity: true,
          status: true,
        },
      },
      payment: {
        select: {
          id: true,
          status: true,
          amount: true,
          provider: true,
          createdAt: true,
        },
      },
      ticket: {
        select: { id: true, ticketNumber: true, status: true },
      },
    },
  });

  if (!request) throw notFound("Ticket request not found");

  if (requesterRole !== "ADMIN" && request.userId !== requesterId) {
    throw forbidden(
      "You do not have permission to view this ticket request",
    );
  }

  const { userId: _ownerId, ...safeRequest } = request;
  return safeRequest;
}

/**
 * Approving a request reserves one place while payment is pending.
 * The Event row is locked (SELECT ... FOR UPDATE) so concurrent
 * approvals serialize and the capacity check cannot race.
 */
export async function approveTicketRequest(ticketRequestId: string) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.ticketRequest.findUnique({
      where: { id: ticketRequestId },
      include: { event: true },
    });

    if (!request) throw notFound("Ticket request not found");

    if (request.status !== "PENDING") {
      throw conflict("Only pending ticket requests can be approved");
    }

    if (request.event.status !== "PUBLISHED") {
      throw conflict(
        "This event is no longer accepting ticket requests",
      );
    }

    await expireStaleReservations(tx, request.eventId);

    await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT "id" FROM "Event" WHERE "id" = ${request.eventId} FOR UPDATE`;

    const occupied = await countOccupiedPlaces(tx, request.eventId);

    if (occupied >= request.event.capacity) {
      throw conflict("Event tickets are full");
    }

    return tx.ticketRequest.update({
      where: { id: ticketRequestId },
      data: {
        status: "PAYMENT_PENDING",
        reviewedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        rejectionReason: true,
        reviewedAt: true,
        createdAt: true,
        user: { select: customerProfileSelect },
        event: {
          select: {
            id: true,
            title: true,
            date: true,
            venue: true,
            ticketPrice: true,
            capacity: true,
          },
        },
      },
    });
  });
}

export async function approveAndNotify(ticketRequestId: string) {
  const request = await approveTicketRequest(ticketRequestId);

  // Do not rotate an existing invite — the requesting browser already
  // holds its token. Create one only if somehow missing.
  const { freshToken } = await ensureInviteForRequest(request.id);
  const baseUrl = publicAppUrl();

  // Fire-and-forget: SMTP latency must not delay the admin's action.
  void sendApprovalEmail(
    request.user.email,
    request.user.name,
    request.event.title,
    `${baseUrl}/events/${request.event.id}`,
    freshToken && process.env.NODE_ENV !== "production"
      ? { devPayLink: `${baseUrl}/pay/${freshToken}` }
      : undefined,
  ).catch((error) =>
    console.error("Failed to send approval email:", error),
  );

  return request;
}

export async function rejectTicketRequest(
  ticketRequestId: string,
  rejectionReason: string,
) {
  const request = await prisma.ticketRequest.findUnique({
    where: { id: ticketRequestId },
    select: { id: true, status: true },
  });

  if (!request) throw notFound("Ticket request not found");

  if (request.status !== "PENDING") {
    throw conflict("Only pending ticket requests can be rejected");
  }

  return prisma.ticketRequest.update({
    where: { id: ticketRequestId },
    data: {
      status: "REJECTED",
      rejectionReason,
      reviewedAt: new Date(),
    },
    select: {
      id: true,
      status: true,
      rejectionReason: true,
      reviewedAt: true,
      createdAt: true,
      user: { select: customerProfileSelect },
      event: {
        select: {
          id: true,
          title: true,
          date: true,
          venue: true,
          ticketPrice: true,
        },
      },
    },
  });
}

/**
 * A customer may cancel their own request while it is PENDING (before
 * admin review), or while PAYMENT_PENDING as long as no payment attempt
 * has been recorded yet (cancelling would orphan an in-flight payment).
 */
export async function cancelTicketRequest(
  userId: string,
  ticketRequestId: string,
) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.ticketRequest.findUnique({
      where: { id: ticketRequestId },
      include: { payment: { select: { id: true, status: true } } },
    });

    if (!request) throw notFound("Ticket request not found");

    if (request.userId !== userId) {
      throw forbidden(
        "You do not have permission to cancel this ticket request",
      );
    }

    if (request.status === "PENDING") {
      // fine — no place is reserved yet
    } else if (request.status === "PAYMENT_PENDING") {
      if (request.payment) {
        throw conflict(
          "This request has a payment on record and can no longer be cancelled online. Please contact support.",
        );
      }
    } else {
      throw conflict(
        `A request with status ${request.status
          .toLowerCase()
          .replace("_", " ")} cannot be cancelled`,
      );
    }

    return tx.ticketRequest.update({
      where: { id: ticketRequestId },
      data: { status: "CANCELLED" },
      select: {
        id: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
        event: {
          select: {
            id: true,
            title: true,
            date: true,
            venue: true,
            ticketPrice: true,
          },
        },
      },
    });
  });
}

export async function getMyTicketRequests(userId: string) {
  await expireStaleReservations();

  return prisma.ticketRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      rejectionReason: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
      event: {
        select: {
          id: true,
          title: true,
          description: true,
          image: true,
          date: true,
          startTime: true,
          endTime: true,
          venue: true,
          ticketPrice: true,
          capacity: true,
          status: true,
        },
      },
      payment: {
        select: { id: true, status: true, amount: true },
      },
      ticket: { select: { id: true, ticketNumber: true, status: true } },
    },
  });
}

export async function getMyPaymentPendingRequests(userId: string) {
  await expireStaleReservations();

  return prisma.ticketRequest.findMany({
    where: {
      userId,
      status: "PAYMENT_PENDING",
      OR: [
        { reviewedAt: { gte: reservationCutoff() } },
        { reviewedAt: null },
      ],
    },
    orderBy: { reviewedAt: "desc" },
    select: {
      id: true,
      status: true,
      reviewedAt: true,
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
        select: { id: true, status: true, amount: true },
      },
    },
  });
}
