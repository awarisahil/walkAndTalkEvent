import type { Request, Response } from "express";
import prisma from "../config/prisma";
import { badRequest, conflict, notFound } from "../utils/AppError";
import {
  getInviteState,
  getInviteRequestId,
} from "../services/invite.service";
import {
  createOrderForPaymentInternal,
  createPaymentForRequest,
  fulfillPayment,
  sendCongratulations,
  verifyAndFulfillPaymentInternal,
} from "../services/payment.service";
import { reservationCutoff } from "../services/reservation.service";
import { verifyPaymentSchema } from "../validators/query.validator";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";

export const getInviteStateController = asyncHandler(
  async (req: Request, res: Response) => {
    const state = await getInviteState(String(req.params.token));
    return ok(res, state);
  },
);

/** Creates the payment + Razorpay order for this invite (one call). */
export const invitePayController = asyncHandler(
  async (req: Request, res: Response) => {
    const requestId = await getInviteRequestId(String(req.params.token));

    const request = await prisma.ticketRequest.findUnique({
      where: { id: requestId },
      select: { status: true, reviewedAt: true },
    });

    if (!request) throw notFound("Ticket request not found");

    if (
      request.status !== "PAYMENT_PENDING" ||
      !request.reviewedAt ||
      request.reviewedAt < reservationCutoff()
    ) {
      throw conflict(
        "Your payment window has expired — please contact the organizer",
      );
    }

    const payment = await createPaymentForRequest(requestId);

    try {
      const order = await createOrderForPaymentInternal(payment!.id);
      return ok(res, { payment, ...order });
    } catch (error) {
      // Razorpay not configured (or unavailable) — return the payment so
      // the page can offer the dev-simulation fallback / contact message.
      if (
        error instanceof Error &&
        /not configured/i.test(error.message)
      ) {
        return ok(res, { payment, order: null, keyId: null });
      }
      throw error;
    }
  },
);

export const inviteVerifyController = asyncHandler(
  async (req: Request, res: Response) => {
    const requestId = await getInviteRequestId(String(req.params.token));

    const validation = verifyPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      throw badRequest("Invalid input", validation.error.flatten());
    }

    const payment = await prisma.payment.findUnique({
      where: {
        providerOrderId: validation.data.razorpayOrderId,
      },
      select: { id: true, ticketRequestId: true },
    });

    if (!payment || payment.ticketRequestId !== requestId) {
      throw notFound("Payment not found");
    }

    const result = await verifyAndFulfillPaymentInternal(
      payment.id,
      validation.data,
    );

    if (!result.alreadyProcessed && result.ticket) {
      await sendCongratulations(payment.id, {
        inviteToken: String(req.params.token),
      }).catch((error) =>
        console.error("Failed to send congratulations email:", error),
      );
    }

    return ok(res, result, { message: "Payment verified successfully" });
  },
);

/** DEV ONLY (never mounted in production): simulate a successful payment. */
export const inviteDevCompleteController = asyncHandler(
  async (req: Request, res: Response) => {
    const requestId = await getInviteRequestId(String(req.params.token));

    const payment = await prisma.payment.findFirst({
      where: { ticketRequestId: requestId },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    if (!payment) {
      // Auto-create the payment for convenience in dev testing.
      await createPaymentForRequest(requestId);
      const created = await prisma.payment.findFirst({
        where: { ticketRequestId: requestId },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      if (!created) throw notFound("Payment not found");
      const result = await fulfillPayment(created.id);
      if (!result.alreadyProcessed && result.ticket) {
        await sendCongratulations(created.id, {
          inviteToken: String(req.params.token),
        }).catch(() => undefined);
      }
      return ok(res, result, {
        message: "Payment completed (dev mode)",
      });
    }

    const result = await fulfillPayment(payment.id);
    if (!result.alreadyProcessed && result.ticket) {
      await sendCongratulations(payment.id, {
        inviteToken: String(req.params.token),
      }).catch(() => undefined);
    }
    return ok(res, result, { message: "Payment completed (dev mode)" });
  },
);
