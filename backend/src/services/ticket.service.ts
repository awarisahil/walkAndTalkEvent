import prisma from "../config/prisma";

export async function getMyTickets(userId: string) {
  return prisma.ticket.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      ticketNumber: true,
      status: true,
      qrCode: true,
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
        select: {
          id: true,
          status: true,
        },
      },
      payment: false,
    },
  });
}

export async function getTicketById(
  userId: string,
  ticketId: string,
) {
  const ticket = await prisma.ticket.findUnique({
    where: {
      id: ticketId,
    },
    select: {
      id: true,
      userId: true,
      ticketNumber: true,
      status: true,
      qrCode: true,
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
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!ticket) {
    throw new Error("Ticket not found");
  }

  if (ticket.userId !== userId) {
    throw new Error(
      "You do not have permission to view this ticket",
    );
  }

  return ticket;
}