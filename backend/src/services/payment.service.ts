import { Prisma } from "../generated/prisma/client";
import prisma from "../config/prisma";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from "../utils/AppError";
import type { Pagination } from "../utils/response";
import { paged } from "../utils/response";
import { generateTicketNumber } from "../utils/ticket";
import { generateQrToken } from "../utils/crypto";
import {
  countOccupiedPlaces,
  expireStaleReservations,
} from "./reservation.service";
import { sendCongratulationsEmail } from "./email.service";
import { publicAppUrl } from "./ticketRequest.service";
import {
  createRazorpayOrder,
  getRazorpayKeyId,
  razorpayEnabled,
  verifyPaymentSignature,
} from "./razorpay.service";
import type { CreatePaymentInput } from "../validators/payment.validator";

/**
 * Internal, idempotent payment fulfillment. This is the ONLY code path
 * that may mark a payment successful and create a ticket; it is invoked
 * after trustworthy confirmation (verified Razorpay signature or webhook).
 *
 * Idempotency: repeated calls for an already-SUCCESS payment return the
 * existing ticket instead of creating a new one.
 */
export async function fulfillPayment(
  paymentId: string,
  options?: { providerPaymentId?: string },
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`,
    );

    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: {
        ticketRequest: { include: { event: true } },
      },
    });

    if (!payment) throw notFound("Payment not found");

    if (payment.status === "SUCCESS") {
      const existingTicket = await tx.ticket.findUnique({
        where: { ticketRequestId: payment.ticketRequestId },
        select: {
          id: true,
          ticketNumber: true,
          status: true,
          createdAt: true,
        },
      });
      return {
        payment: {
          id: payment.id,
          amount: payment.amount,
          status: payment.status,
        },
        ticket: existingTicket,
        alreadyProcessed: true,
      };
    }

    if (payment.status !== "PENDING") {
      throw conflict(
        `Payment is ${payment.status.toLowerCase()} and cannot be fulfilled`,
      );
    }

    if (payment.ticketRequest.status !== "PAYMENT_PENDING") {
      throw conflict("Ticket request is not awaiting payment");
    }

    if (payment.ticketRequest.event.status !== "PUBLISHED") {
      throw conflict(
        "This event is no longer available; payment has not been captured",
      );
    }

    // Re-verify capacity under lock: the reservation is held, but the
    // event capacity may have been reduced since approval.
    const occupied = await countOccupiedPlaces(tx, payment.eventId);
    if (occupied > payment.ticketRequest.event.capacity) {
      throw conflict(
        "Event capacity changed while processing payment; payment has not been captured",
      );
    }

    const updatedPayment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "SUCCESS",
        ...(options?.providerPaymentId
          ? { providerPaymentId: options.providerPaymentId }
          : {}),
      },
    });

    await tx.ticketRequest.update({
      where: { id: payment.ticketRequestId },
      data: { status: "PAID" },
    });

    let ticket;
    try {
      ticket = await tx.ticket.create({
        data: {
          ticketNumber: generateTicketNumber(),
          userId: payment.userId,
          eventId: payment.eventId,
          ticketRequestId: payment.ticketRequestId,
          status: "ACTIVE",
          qrCode: generateQrToken(),
        },
        select: {
          id: true,
          ticketNumber: true,
          status: true,
          qrCode: true,
          createdAt: true,
        },
      });
    } catch (error) {
      // Unique constraint on ticketRequestId: another process already
      // issued the ticket — recover gracefully instead of duplicating.
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        ticket = await tx.ticket.findUnique({
          where: { ticketRequestId: payment.ticketRequestId },
          select: {
            id: true,
            ticketNumber: true,
            status: true,
            qrCode: true,
            createdAt: true,
          },
        });
      } else {
        throw error;
      }
    }

    return {
      payment: {
        id: updatedPayment.id,
        amount: updatedPayment.amount,
        status: updatedPayment.status,
      },
      ticket,
      alreadyProcessed: false,
    };
  });
}

/** Emails the attendee their confirmed ticket after payment. The link is
 *  shareable — anyone with it can view the ticket/QR (no login). */
export async function sendCongratulations(
  paymentId: string,
  options?: { inviteToken?: string },
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      user: { select: { name: true, email: true } },
      event: { select: { id: true, title: true } },
      ticketRequest: {
        select: {
          ticket: { select: { ticketNumber: true } },
        },
      },
    },
  });

  if (!payment) return;

  const ticket = payment.ticketRequest.ticket;
  if (!ticket) return;

  const ticketUrl = options?.inviteToken
    ? `${publicAppUrl()}/pay/${options.inviteToken}`
    : `${publicAppUrl()}/login`;

  await sendCongratulationsEmail(
    payment.user.email,
    payment.user.name,
    payment.event.title,
    ticket.ticketNumber,
    ticketUrl,
  );
}

export async function createPayment(
  userId: string,
  input: CreatePaymentInput,
) {
  const request = await prisma.ticketRequest.findUnique({
    where: { id: input.ticketRequestId },
    select: { userId: true },
  });

  if (!request) throw notFound("Ticket request not found");

  if (request.userId !== userId) {
    throw forbidden(
      "You do not have permission to pay for this ticket request",
    );
  }

  return createPaymentForRequest(input.ticketRequestId);
}

/**
 * Creates (or idempotently re-initializes) the payment for an approved
 * request. Ownership is established by the caller (session or invite token).
 */
export async function createPaymentForRequest(ticketRequestId: string) {
  await expireStaleReservations();

  const request = await prisma.ticketRequest.findUnique({
    where: { id: ticketRequestId },
    include: { event: true, payment: true },
  });

  if (!request) throw notFound("Ticket request not found");

  if (request.status !== "PAYMENT_PENDING") {
    throw badRequest(
      "Payment can only be started for an approved ticket request",
    );
  }

  if (request.event.status !== "PUBLISHED") {
    throw conflict("This event is no longer available");
  }

  if (request.payment) {
    if (request.payment.status === "PENDING") {
      return prisma.payment.findUnique({
        where: { id: request.payment.id },
        select: {
          id: true,
          amount: true,
          status: true,
          provider: true,
          providerOrderId: true,
          createdAt: true,
          event: {
            select: { id: true, title: true, date: true, venue: true },
          },
          ticketRequest: { select: { id: true, status: true } },
        },
      });
    }
    if (request.payment.status === "SUCCESS") {
      throw conflict("This request has already been paid");
    }
    // FAILED payments are retried by reusing the same payment row so
    // the one-payment-per-request invariant holds.
  }

  const payment = request.payment
    ? await prisma.payment.update({
        where: { id: request.payment.id },
        data: {
          status: "PENDING",
          amount: request.event.ticketPrice,
          provider: "RAZORPAY",
          providerOrderId: null,
          providerPaymentId: null,
        },
      })
    : await prisma.payment.create({
        data: {
          userId: request.userId,
          eventId: request.eventId,
          ticketRequestId: request.id,
          amount: request.event.ticketPrice,
          status: "PENDING",
          provider: "RAZORPAY",
        },
      });

  return prisma.payment.findUnique({
    where: { id: payment.id },
    select: {
      id: true,
      amount: true,
      status: true,
      provider: true,
      providerOrderId: true,
      createdAt: true,
      event: { select: { id: true, title: true, date: true, venue: true } },
      ticketRequest: { select: { id: true, status: true } },
    },
  });
}

export async function createOrderForPayment(
  userId: string,
  paymentId: string,
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { userId: true },
  });

  if (!payment) throw notFound("Payment not found");

  if (payment.userId !== userId) {
    throw forbidden(
      "You do not have permission to pay for this ticket request",
    );
  }

  return createOrderForPaymentInternal(paymentId);
}

export async function createOrderForPaymentInternal(paymentId: string) {
  if (!razorpayEnabled()) {
    throw badRequest(
      "Online payments are not configured yet; please contact the organizer",
    );
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { ticketRequest: true },
  });

  if (!payment) throw notFound("Payment not found");

  if (payment.status !== "PENDING") {
    throw conflict("This payment can no longer be processed");
  }

  if (payment.ticketRequest.status !== "PAYMENT_PENDING") {
    throw conflict("Ticket request is not awaiting payment");
  }

  // Amount always comes from the database, never the client.
  const amount = Number(payment.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw conflict("Invalid payment amount; please contact support");
  }

  const order = await createRazorpayOrder({
    receipt: payment.id,
    amountInPaise: Math.round(amount * 100),
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { providerOrderId: order.id },
  });

  return {
    order: {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    },
    keyId: getRazorpayKeyId(),
    paymentId: payment.id,
  };
}

export async function verifyAndFulfillPayment(
  userId: string,
  input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  },
) {
  const payment = await prisma.payment.findUnique({
    where: { providerOrderId: input.razorpayOrderId },
    select: { id: true, userId: true },
  });

  if (!payment) throw notFound("Payment not found");

  if (payment.userId !== userId) {
    throw forbidden(
      "You do not have permission to verify this payment",
    );
  }

  return verifyAndFulfillPaymentInternal(payment.id, input);
}

/** Signature verification + fulfillment. Callers must establish that the
 *  order belongs to the request they scoped (session user or invite token). */
export async function verifyAndFulfillPaymentInternal(
  paymentId: string,
  input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  },
) {
  const valid = verifyPaymentSignature({
    orderId: input.razorpayOrderId,
    paymentId: input.razorpayPaymentId,
    signature: input.razorpaySignature,
  });

  if (!valid) {
    throw badRequest("Payment verification failed");
  }

  return fulfillPayment(paymentId, {
    providerPaymentId: input.razorpayPaymentId,
  });
}

/**
 * DEV-ONLY simulation of payment success. Never mounted in production
 * (see payment.routes.ts).
 */
export async function completePaymentDev(
  userId: string,
  paymentId: string,
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { userId: true },
  });

  if (!payment) throw notFound("Payment not found");

  if (payment.userId !== userId) {
    throw forbidden(
      "You do not have permission to complete this payment",
    );
  }

  return fulfillPayment(paymentId);
}

export async function getMyPayments(userId: string) {
  return prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      amount: true,
      status: true,
      provider: true,
      providerOrderId: true,
      createdAt: true,
      updatedAt: true,
      event: {
        select: { id: true, title: true, date: true, venue: true },
      },
      ticketRequest: { select: { id: true, status: true } },
    },
  });
}

export async function getPaymentById(userId: string, paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
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
      ticketRequest: { select: { id: true, status: true } },
    },
  });

  if (!payment) throw notFound("Payment not found");

  if (payment.userId !== userId) {
    throw forbidden(
      "You do not have permission to view this payment",
    );
  }

  const { userId: _ownerId, ...safePayment } = payment;
  return safePayment;
}

export async function listPaymentsForAdmin(
  query: {
    status?: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";
    eventId?: string;
    search?: string;
  },
  pagination: Pagination,
) {
  const where: Prisma.PaymentWhereInput = {};

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

  const total = await prisma.payment.count({ where });
  const payments = await prisma.payment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
    select: {
      id: true,
      amount: true,
      status: true,
      provider: true,
      providerOrderId: true,
      providerPaymentId: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: { id: true, name: true, email: true },
      },
      event: {
        select: { id: true, title: true, date: true },
      },
      ticketRequest: { select: { id: true, status: true } },
    },
  });

  return paged(payments, total, pagination);
}
