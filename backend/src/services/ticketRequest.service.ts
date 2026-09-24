import prisma from "../config/prisma";
import { CreateTicketRequestInput } from "../validators/ticketRequest.validator";

export async function createTicketRequest(
  userId: string,
  input: CreateTicketRequestInput,
) {
  // 1. Check whether the event exists
  const event = await prisma.event.findUnique({
    where: {
      id: input.eventId,
    },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  // 2. Customer can request tickets only for published events
  if (event.status !== "PUBLISHED") {
    throw new Error(
      "Tickets can only be requested for published events",
    );
  }

  // 3. Check whether this customer already requested this event
  const existingRequest = await prisma.ticketRequest.findUnique({
    where: {
      userId_eventId: {
        userId,
        eventId: input.eventId,
      },
    },
  });

  if (existingRequest) {
    throw new Error(
      "You have already requested a ticket for this event",
    );
  }

  // 4. Create the ticket request
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

export async function getTicketRequestsForAdmin() {
  const requests = await prisma.ticketRequest.findMany({
    orderBy: {
      createdAt: "desc",
    },

    select: {
      id: true,
      status: true,
      rejectionReason: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,

      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          age: true,
          instagramUsername: true,
          instagramProfileUrl: true,
        },
      },

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
    },
  });

  return requests;
}
export async function approveTicketRequest(
  ticketRequestId: string,
) {
  return await prisma.$transaction(async (tx) => {
    const request = await tx.ticketRequest.findUnique({
      where: {
        id: ticketRequestId,
      },
      include: {
        event: true,
        user: true,
      },
    });

    if (!request) {
      throw new Error("Ticket request not found");
    }

    if (request.status !== "PENDING") {
      throw new Error(
        "Only pending ticket requests can be approved",
      );
    }

    // Count tickets that have already been allocated.
    const allocatedTickets = await tx.ticket.count({
      where: {
        eventId: request.eventId,
        status: {
          in: ["ACTIVE", "USED"],
        },
      },
    });

    if (allocatedTickets >= request.event.capacity) {
      throw new Error("Event tickets are full");
    }

    const updatedRequest = await tx.ticketRequest.update({
      where: {
        id: ticketRequestId,
      },
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

        user: {
          select: {
            id: true,
            name: true,
            email: true,
            age: true,
            instagramUsername: true,
            instagramProfileUrl: true,
          },
        },

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

    return updatedRequest;
  });
}

export async function rejectTicketRequest(
  ticketRequestId: string,
  rejectionReason: string,
) {
  const request = await prisma.ticketRequest.findUnique({
    where: {
      id: ticketRequestId,
    },
  });

  if (!request) {
    throw new Error("Ticket request not found");
  }

  if (request.status !== "PENDING") {
    throw new Error(
      "Only pending ticket requests can be rejected",
    );
  }

  const rejectedRequest = await prisma.ticketRequest.update({
    where: {
      id: ticketRequestId,
    },
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

      user: {
        select: {
          id: true,
          name: true,
          email: true,
          age: true,
          instagramUsername: true,
          instagramProfileUrl: true,
        },
      },

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

  return rejectedRequest;
}

export async function getMyTicketRequests(userId: string) {
  const requests = await prisma.ticketRequest.findMany({
    where: {
      userId,
    },

    orderBy: {
      createdAt: "desc",
    },

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
    },
  });

  return requests;
}

export async function getMyPaymentPendingRequests(
  userId: string,
) {
  const requests = await prisma.ticketRequest.findMany({
    where: {
      userId,
      status: "PAYMENT_PENDING",
    },

    orderBy: {
      reviewedAt: "desc",
    },

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
    },
  });

  return requests;
}