import prisma from "../config/prisma";
import { CreateEventInput } from "../validators/event.validator";

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