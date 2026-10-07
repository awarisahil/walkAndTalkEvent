import prisma from "../config/prisma";
import { CreatePaymentInput } from "../validators/payment.validator";
import { generateTicketNumber } from "../utils/ticket";
export async function createPayment(
  userId: string,
  input: CreatePaymentInput,
) {
  const request = await prisma.ticketRequest.findUnique({
    where: {
      id: input.ticketRequestId,
    },
    include: {
      event: true,
      payment: true,
    },
  });

  if (!request) {
    throw new Error("Ticket request not found");
  }

  if (request.userId !== userId) {
    throw new Error("You do not have permission to pay for this request");
  }

  if (request.status !== "PAYMENT_PENDING") {
    throw new Error(
      "Payment can only be started for an approved ticket request",
    );
  }

  if (request.payment) {
    throw new Error("Payment has already been initiated for this request");
  }

  if (request.event.status !== "PUBLISHED") {
    throw new Error("This event is no longer available");
  }

  const payment = await prisma.payment.create({
    data: {
      userId,
      eventId: request.eventId,
      ticketRequestId: request.id,
      amount: request.event.ticketPrice,
      status: "PENDING",
      provider: "RAZORPAY",
    },
    select: {
      id: true,
      amount: true,
      status: true,
      provider: true,
      createdAt: true,
      event: {
        select: {
          id: true,
          title: true,
          date: true,
          venue: true,
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

  return payment;
}
export async function getMyPayments(userId: string) {
  return prisma.payment.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      amount: true,
      status: true,
      provider: true,
      providerOrderId: true,
      providerPaymentId: true,
      createdAt: true,
      updatedAt: true,
      event: {
        select: {
          id: true,
          title: true,
          date: true,
          venue: true,
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
}

export async function getPaymentById(
  userId: string,
  paymentId: string,
) {
  const payment = await prisma.payment.findUnique({
    where: {
      id: paymentId,
    },
    select: {
      id: true,
      userId: true,
      amount: true,
      status: true,
      provider: true,
      providerOrderId: true,
      providerPaymentId: true,
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
      ticketRequest: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  if (payment.userId !== userId) {
    throw new Error(
      "You do not have permission to view this payment",
    );
  }

  return payment;
}

export async function completePayment(
  userId: string,
  paymentId: string,
) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        ticketRequest: true,
        event: true,
      },
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.userId !== userId) {
      throw new Error(
        "You do not have permission to complete this payment",
      );
    }

    if (payment.status === "SUCCESS") {
      throw new Error("Payment has already been completed");
    }

    if (payment.status !== "PENDING") {
      throw new Error("Only pending payments can be completed");
    }

    if (payment.ticketRequest.status !== "PAYMENT_PENDING") {
      throw new Error(
        "Ticket request is not awaiting payment",
      );
    }

    const existingTicket = await tx.ticket.findUnique({
      where: {
        ticketRequestId: payment.ticketRequestId,
      },
    });

    if (existingTicket) {
      throw new Error("Ticket already exists for this payment");
    }

    const ticketNumber = generateTicketNumber();

    const updatedPayment = await tx.payment.update({
      where: {
        id: paymentId,
      },
      data: {
        status: "SUCCESS",
      },
    });

    await tx.ticketRequest.update({
      where: {
        id: payment.ticketRequestId,
      },
      data: {
        status: "PAID",
      },
    });

    const ticket = await tx.ticket.create({
      data: {
        ticketNumber,
        userId: payment.userId,
        eventId: payment.eventId,
        ticketRequestId: payment.ticketRequestId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            title: true,
            date: true,
            startTime: true,
            endTime: true,
            venue: true,
          },
        },
      },
    });

    return {
      payment: {
        id: updatedPayment.id,
        amount: updatedPayment.amount,
        status: updatedPayment.status,
      },
      ticketRequest: {
        id: payment.ticketRequest.id,
        status: "PAID",
      },
      ticket,
    };
  });
}