import { Prisma } from "../generated/prisma/client";
import prisma from "../config/prisma";
import {
  conflict,
  forbidden,
  notFound,
} from "../utils/AppError";
import type { PagedResult, Pagination } from "../utils/response";
import { paged } from "../utils/response";
import {
  countOccupiedPlaces,
  expireStaleReservations,
} from "./reservation.service";

const ticketDetailSelect = {
  id: true,
  ticketNumber: true,
  status: true,
  qrCode: true,
  usedAt: true,
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
    },
  },
  ticketRequest: {
    select: { id: true, status: true },
  },
} satisfies Prisma.TicketSelect;

export async function getMyTickets(userId: string) {
  return prisma.ticket.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: ticketDetailSelect,
  });
}

export async function getTicketById(userId: string, ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { ...ticketDetailSelect, userId: true },
  });

  if (!ticket) throw notFound("Ticket not found");

  if (ticket.userId !== userId) {
    throw forbidden(
      "You do not have permission to view this ticket",
    );
  }

  const { userId: _ownerId, ...safeTicket } = ticket;
  return safeTicket;
}

export interface AttendeeQuery {
  search?: string;
  status?: "ACTIVE" | "USED" | "CANCELLED";
  page: number;
  pageSize: number;
}

export async function getEventAttendees(
  eventId: string,
  query: AttendeeQuery,
): Promise<{
  stats: {
    capacity: number;
    reserved: number;
    confirmed: number;
    used: number;
    remaining: number;
  };
  result: PagedResult<unknown>;
}> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, capacity: true },
  });
  if (!event) throw notFound("Event not found");

  await expireStaleReservations(prisma, eventId);

  const where: Prisma.TicketWhereInput = { eventId };
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { ticketNumber: { contains: query.search, mode: "insensitive" } },
      {
        user: {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const [total, tickets, occupied, confirmed, used] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        createdAt: true,
        usedAt: true,
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    }),
    countOccupiedPlaces(prisma, eventId),
    prisma.ticket.count({
      where: { eventId, status: { in: ["ACTIVE", "USED"] } },
    }),
    prisma.ticket.count({ where: { eventId, status: "USED" } }),
  ]);

  return {
    stats: {
      capacity: event.capacity,
      reserved: Math.max(0, occupied - confirmed),
      confirmed,
      used,
      remaining: Math.max(0, event.capacity - occupied),
    },
    result: paged(tickets, total, {
      page: query.page,
      pageSize: query.pageSize,
    }),
  };
}

export async function exportEventAttendeesCsv(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true },
  });
  if (!event) throw notFound("Event not found");

  const tickets = await prisma.ticket.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: {
      ticketNumber: true,
      status: true,
      createdAt: true,
      usedAt: true,
      user: { select: { name: true, email: true, phone: true } },
    },
  });

  const header = "Ticket Number,Name,Email,Phone,Status,Checked In At,Purchase Date";
  const rows = tickets.map((t) =>
    [
      t.ticketNumber,
      csvEscape(t.user.name),
      csvEscape(t.user.email),
      csvEscape(t.user.phone ?? ""),
      t.status,
      t.usedAt ? t.usedAt.toISOString() : "",
      t.createdAt.toISOString(),
    ].join(","),
  );

  return {
    filename: `${event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-attendees.csv`,
    csv: [header, ...rows].join("\n"),
  };
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function lookupTicketForAdmin(
  ticketNumber: string,
  eventId?: string,
) {
  const ticket = await prisma.ticket.findFirst({
    where: {
      ticketNumber: { equals: ticketNumber, mode: "insensitive" },
      ...(eventId ? { eventId } : {}),
    },
    select: {
      id: true,
      ticketNumber: true,
      status: true,
      createdAt: true,
      usedAt: true,
      event: { select: { id: true, title: true, date: true, venue: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!ticket) throw notFound("Ticket not found");
  return ticket;
}

/**
 * Atomic check-in: only a ticket in ACTIVE status can transition to
 * USED; the conditional update makes double check-in impossible even
 * under concurrency.
 */
export async function checkInTicket(
  adminId: string,
  input: { ticketNumber?: string; qrToken?: string; eventId?: string },
) {
  if (!input.ticketNumber && !input.qrToken) {
    throw notFound("Ticket not found");
  }

  const ticket = await prisma.ticket.findFirst({
    where: {
      ...(input.eventId ? { eventId: input.eventId } : {}),
      ...(input.ticketNumber
        ? {
            ticketNumber: {
              equals: input.ticketNumber,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(input.qrToken ? { qrCode: input.qrToken } : {}),
    },
    select: {
      id: true,
      status: true,
      ticketNumber: true,
      event: { select: { id: true, title: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!ticket) throw notFound("Ticket not found");

  if (input.eventId && ticket.event.id !== input.eventId) {
    throw conflict("This ticket belongs to a different event");
  }

  if (ticket.status === "USED") {
    throw conflict("Ticket has already been checked in");
  }

  if (ticket.status === "CANCELLED") {
    throw conflict("This ticket has been cancelled and cannot be used");
  }

  const claimed = await prisma.ticket.updateMany({
    where: { id: ticket.id, status: "ACTIVE" },
    data: { status: "USED", usedAt: new Date(), usedById: adminId },
  });

  if (claimed.count === 0) {
    throw conflict(
      "Ticket was just checked in by someone else; please refresh",
    );
  }

  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    status: "USED" as const,
    usedAt: new Date(),
    event: ticket.event,
    user: ticket.user,
  };
}
