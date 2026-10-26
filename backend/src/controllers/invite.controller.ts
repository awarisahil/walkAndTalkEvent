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
import {
  createRazorpayPaymentLink,
  fetchRazorpayPaymentLink,
  razorpayEnabled,
} from "../services/razorpay.service";
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

/**
 * UPI QR flow: creates (or reuses) a Razorpay Payment Link for this
 * invite and returns its short URL — the frontend renders it as a QR.
 */
export const inviteUpiQrController = asyncHandler(
  async (req: Request, res: Response) => {
    const requestId = await getInviteRequestId(String(req.params.token));

    const request = await prisma.ticketRequest.findUnique({
      where: { id: requestId },
      include: {
        event: { select: { title: true } },
        user: { select: { name: true, email: true, phone: true } },
      },
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

    if (!razorpayEnabled()) {
      throw badRequest(
        "Online payments are not configured yet; please contact the organizer",
      );
    }

    const payment = await createPaymentForRequest(requestId);
    if (!payment) throw notFound("Payment not found");

    // Reuse an existing payment link when present (idempotent re-open).
    const existing = await prisma.payment.findUnique({
      where: { id: payment.id },
      select: { providerOrderId: true },
    });
    if (existing?.providerOrderId?.startsWith("plink_")) {
      const link = await fetchRazorpayPaymentLink(
        existing.providerOrderId,
      ).catch(() => null);
      if (link?.short_url) {
        return ok(res, {
          qrUrl: link.short_url,
          amount: payment.amount,
          paymentId: payment.id,
        });
      }
    }

    const amount = Number(payment.amount);
    if (!Number.isFinite(amount) || amount < 1) {
      throw conflict("Invalid payment amount; please contact support");
    }

    const link = await createRazorpayPaymentLink({
      amountInPaise: Math.round(amount * 100),
      referenceId: payment.id,
      description: `${request.event.title} — Walk & Talk Events`,
      customerName: request.user.name,
      customerEmail: request.user.email,
      customerPhone: request.user.phone,
      notes: {
        paymentId: payment.id,
        ticketRequestId: requestId,
      },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerOrderId: link.id },
    });

    return ok(res, {
      qrUrl: link.short_url,
      amount: payment.amount,
      paymentId: payment.id,
    });
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
