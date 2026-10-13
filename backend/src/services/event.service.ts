import { Prisma } from "../generated/prisma/client";
import prisma from "../config/prisma";
import {
  badRequest,
  conflict,
  notFound,
} from "../utils/AppError";
import type { PagedResult, Pagination } from "../utils/response";
import { paged } from "../utils/response";
import {
  countOccupiedPlaces,
  expireStaleReservations,
} from "./reservation.service";
import type {
  CreateEventInput,
  UpdateEventInput,
} from "../validators/event.validator";

const eventCardSelect = {
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
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EventSelect;

interface EventListQuery {
  search?: string;
  status?: "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";
  dateFrom?: string;
  dateTo?: string;
}

function buildWhere(query: EventListQuery, admin: boolean) {
  const where: Prisma.EventWhereInput = {};

  if (!admin) {
    where.status = "PUBLISHED";
  } else if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { venue: { contains: query.search, mode: "insensitive" } },
    ];
  }

  if (query.dateFrom || query.dateTo) {
    where.date = {};
    if (query.dateFrom) {
      const from = new Date(query.dateFrom);
      if (Number.isNaN(from.getTime())) {
        throw badRequest("Invalid dateFrom value");
      }
      where.date.gte = from;
    }
    if (query.dateTo) {
      const to = new Date(query.dateTo);
      if (Number.isNaN(to.getTime())) {
        throw badRequest("Invalid dateTo value");
      }
      where.date.lte = to;
    }
  }

  return where;
}

async function withAvailability<
  T extends { id: string; capacity: number },
>(events: T[]) {
  if (events.length === 0) return [];

  const occupied = await prisma.ticketRequest.groupBy({
    by: ["eventId"],
    where: {
      eventId: { in: events.map((e) => e.id) },
      status: { in: ["PAYMENT_PENDING", "PAID"] },
    },
    _count: { _all: true },
  });
  const occupiedByEvent = new Map(
    occupied.map((o) => [o.eventId, o._count._all]),
  );

  return events.map((event) => ({
    ...event,
    occupied: occupiedByEvent.get(event.id) ?? 0,
    available: Math.max(
      0,
      event.capacity - (occupiedByEvent.get(event.id) ?? 0),
    ),
  }));
}

export async function listPublicEvents(
  query: EventListQuery,
  pagination: Pagination,
): Promise<PagedResult<Awaited<ReturnType<typeof withAvailability>>[number]>> {
  await expireStaleReservations();

  const where = buildWhere(query, false);
  const total = await prisma.event.count({ where });
  const events = await prisma.event.findMany({
    where,
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
    select: eventCardSelect,
  });

  return paged(await withAvailability(events), total, pagination);
}

export async function listAdminEvents(
  query: EventListQuery,
  pagination: Pagination,
) {
  await expireStaleReservations();

  const where = buildWhere(query, true);
  const total = await prisma.event.count({ where });
  const events = await prisma.event.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
    select: eventCardSelect,
  });

  return paged(await withAvailability(events), total, pagination);
}

async function findEventOrThrow(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: eventCardSelect,
  });
  if (!event) throw notFound("Event not found");
  return event;
}

export async function getAdminEventById(eventId: string) {
  await expireStaleReservations();
  const event = await findEventOrThrow(eventId);

  const [occupied, requestCounts] = await Promise.all([
    countOccupiedPlaces(prisma, eventId),
    prisma.ticketRequest.groupBy({
      by: ["status"],
      where: { eventId },
      _count: { _all: true },
    }),
  ]);

  const counts = Object.fromEntries(
    requestCounts.map((r) => [r.status, r._count._all]),
  );

  return {
    ...event,
    occupied,
    available: Math.max(0, event.capacity - occupied),
    requestCounts: {
      pending: counts["PENDING"] ?? 0,
      paymentPending: counts["PAYMENT_PENDING"] ?? 0,
      paid: counts["PAID"] ?? 0,
      rejected: counts["REJECTED"] ?? 0,
      cancelled: counts["CANCELLED"] ?? 0,
      expired: counts["EXPIRED"] ?? 0,
    },
  };
}

export async function getPublishedEventById(eventId: string) {
  await expireStaleReservations();

  const event = await prisma.event.findFirst({
    where: { id: eventId, status: "PUBLISHED" },
    select: eventCardSelect,
  });
  if (!event) throw notFound("Event not found");

  const occupied = await countOccupiedPlaces(prisma, eventId);

  return {
    ...event,
    occupied,
    available: Math.max(0, event.capacity - occupied),
  };
}

export async function createEvent(input: CreateEventInput) {
  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) {
    throw badRequest("Invalid event date");
  }
  if (date.getTime() <= Date.now()) {
    throw badRequest("Event date must be in the future");
  }

  return prisma.event.create({
    data: {
      title: input.title,
      description: input.description,
      image: input.image,
      date,
      startTime: input.startTime,
      endTime: input.endTime,
      venue: input.venue,
      ticketPrice: input.ticketPrice,
      capacity: input.capacity,
      status: "DRAFT",
    },
    select: eventCardSelect,
  });
}

export async function updateEvent(
  eventId: string,
  input: UpdateEventInput,
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw notFound("Event not found");

  if (event.status === "CANCELLED" || event.status === "COMPLETED") {
    throw conflict("Cancelled or completed events cannot be edited");
  }

  if (input.date !== undefined) {
    const date = new Date(input.date);
    if (Number.isNaN(date.getTime())) {
      throw badRequest("Invalid event date");
    }
    if (date.getTime() <= Date.now()) {
      throw badRequest("Event date must be in the future");
    }
  }

  if (input.capacity !== undefined) {
    await expireStaleReservations();
    const occupied = await countOccupiedPlaces(prisma, eventId);
    if (input.capacity < occupied) {
      throw conflict(
        `Capacity cannot be reduced below the number of reserved places (${occupied})`,
      );
    }
  }

  return prisma.event.update({
    where: { id: eventId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.image !== undefined && { image: input.image }),
      ...(input.date !== undefined && { date: new Date(input.date) }),
      ...(input.startTime !== undefined && { startTime: input.startTime }),
      ...(input.endTime !== undefined && { endTime: input.endTime }),
      ...(input.venue !== undefined && { venue: input.venue }),
      ...(input.ticketPrice !== undefined && {
        ticketPrice: input.ticketPrice,
      }),
      ...(input.capacity !== undefined && { capacity: input.capacity }),
    },
    select: eventCardSelect,
  });
}

export async function publishEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw notFound("Event not found");

  if (event.status === "PUBLISHED") return event;
  if (event.status !== "DRAFT") {
    throw conflict("Only draft events can be published");
  }

  return prisma.event.update({
    where: { id: eventId },
    data: { status: "PUBLISHED" },
    select: eventCardSelect,
  });
}

export async function cancelEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw notFound("Event not found");

  if (event.status === "CANCELLED") return event;
  if (event.status === "COMPLETED") {
    throw conflict("Completed events cannot be cancelled");
  }

  return prisma.event.update({
    where: { id: eventId },
    data: { status: "CANCELLED" },
    select: eventCardSelect,
  });
}

export async function completeEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw notFound("Event not found");

  if (event.status === "COMPLETED") return event;
  if (event.status !== "PUBLISHED") {
    throw conflict("Only published events can be completed");
  }

  return prisma.event.update({
    where: { id: eventId },
    data: { status: "COMPLETED" },
    select: eventCardSelect,
  });
}
