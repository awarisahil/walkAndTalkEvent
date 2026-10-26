import type { Request, Response } from "express";
import prisma from "../config/prisma";
import { fulfillPayment } from "../services/payment.service";
import {
  razorpayWebhookConfigured,
  verifyWebhookSignature,
} from "../services/razorpay.service";
import { asyncHandler } from "../utils/asyncHandler";
import { badRequest } from "../utils/AppError";

/**
 * Razorpay webhook receiver. Mounted with express.raw() so the signature
 * can be verified against the untouched request body.
 *
 * Idempotency: fulfillPayment() is safe to invoke repeatedly — a
 * payment that is already SUCCESS returns its existing ticket and never
 * creates a duplicate.
 */
export const razorpayWebhookController = asyncHandler(
  async (req: Request, res: Response) => {
    if (!razorpayWebhookConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Webhook endpoint is not configured",
      });
    }

    const signature = req.headers["x-razorpay-signature"];
    if (typeof signature !== "string") {
      throw badRequest("Missing webhook signature");
    }

    const rawBody = req.body;
    const bodyBuffer = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(JSON.stringify(rawBody));

    const valid = verifyWebhookSignature(bodyBuffer, signature);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    let event: {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            status?: string;
          };
        };
      };
    };
    try {
      event = JSON.parse(bodyBuffer.toString("utf-8"));
    } catch {
      throw badRequest("Invalid webhook payload");
    }

    const paymentEntity = event.payload?.payment?.entity;
    const linkEntity = (
      event as {
        payload?: {
          payment_link?: { entity?: { id?: string; status?: string } };
        };
      }
    ).payload?.payment_link?.entity;

    /** Resolve our internal payment id from a webhook payload:
     *  1. payment entity notes (payment links carry our id in notes)
     *  2. providerOrderId match (standard checkout orders / link ids) */
    const resolvePaymentId = async (): Promise<string | null> => {
      const noted = (
        paymentEntity as { notes?: { paymentId?: string } } | undefined
      )?.notes?.paymentId;
      if (noted) return noted;

      const ref =
        paymentEntity?.order_id ?? paymentEntity?.id ?? linkEntity?.id;
      if (!ref) return null;

      const payment = await prisma.payment.findUnique({
        where: { providerOrderId: ref },
        select: { id: true },
      });
      return payment?.id ?? null;
    };

    const markFailed = async () => {
      const id = await resolvePaymentId();
      if (!id) return;
      const payment = await prisma.payment.findUnique({
        where: { id },
        select: { status: true },
      });
      if (payment && payment.status === "PENDING") {
        await prisma.payment.update({
          where: { id },
          data: { status: "FAILED" },
        });
      }
    };

    const capture = async () => {
      const id = await resolvePaymentId();
      if (!id) return;
      await fulfillPayment(id, {
        providerPaymentId: paymentEntity?.id,
      });
    };

    if (
      event.event === "payment.captured" ||
      event.event === "payment_link.paid" ||
      (event.event === "order.paid" && paymentEntity)
    ) {
      await capture();
    }

    if (event.event === "payment.failed" || event.event === "payment_link.failed") {
      await markFailed();
    }

    return res.status(200).json({ success: true });
  },
);
