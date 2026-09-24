import prisma from "../config/prisma";
import { CreateEventInput, UpdateEventInput } from "../validators/event.validator";

export async function getPublishedEvents() {
  const events = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
    },
    orderBy: {
      date: "asc",
    },
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
      createdAt: true,
    },
  });

  return events;
}

export async function cancelEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  if (event.status === "CANCELLED") {
    throw new Error("Event is already cancelled");
  }

  if (event.status === "COMPLETED") {
    throw new Error("Completed events cannot be cancelled");
  }

  const cancelledEvent = await prisma.event.update({
    where: { id: eventId },
    data: {
      status: "CANCELLED",
    },
  });

  return cancelledEvent;
}

export async function completeEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  if (event.status === "COMPLETED") {
    throw new Error("Event is already completed");
  }

  if (event.status !== "PUBLISHED") {
    throw new Error(
      "Only published events can be completed",
    );
  }

  const completedEvent = await prisma.event.update({
    where: { id: eventId },
    data: {
      status: "COMPLETED",
    },
  });

  return completedEvent;
}
export async function updateEvent(
  eventId: string,
  input: UpdateEventInput,
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  if (
    event.status === "CANCELLED" ||
    event.status === "COMPLETED"
  ) {
    throw new Error(
      "Cancelled or completed events cannot be edited",
    );
  }

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...(input.title !== undefined && {
        title: input.title,
      }),

      ...(input.description !== undefined && {
        description: input.description,
      }),

      ...(input.image !== undefined && {
        image: input.image,
      }),

      ...(input.date !== undefined && {
        date: new Date(input.date),
      }),

      ...(input.startTime !== undefined && {
        startTime: input.startTime,
      }),

      ...(input.endTime !== undefined && {
        endTime: input.endTime,
      }),

      ...(input.venue !== undefined && {
        venue: input.venue,
      }),

      ...(input.ticketPrice !== undefined && {
        ticketPrice: input.ticketPrice,
      }),

      ...(input.capacity !== undefined && {
        capacity: input.capacity,
      }),
    },
  });

  return updatedEvent;
}
export async function createEvent(input: CreateEventInput) {
  const event = await prisma.event.create({
    data: {
      title: input.title,
      description: input.description,
      image: input.image,
      date: new Date(input.date),
      startTime: input.startTime,
      endTime: input.endTime,
      venue: input.venue,
      ticketPrice: input.ticketPrice,
      capacity: input.capacity,
      status: "DRAFT",
    },
  });

  return event;
}

export async function getPublishedEventById(eventId: string) {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      status: "PUBLISHED",
    },
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
      createdAt: true,
    },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  return event;
}

export async function publishEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
    },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  if (event.status !== "DRAFT") {
    throw new Error("Only draft events can be published");
  }

  const publishedEvent = await prisma.event.update({
    where: {
      id: eventId,
    },
    data: {
      status: "PUBLISHED",
    },
  });

  return publishedEvent;
}