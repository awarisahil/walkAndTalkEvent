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

    if (event.event === "payment.captured" && paymentEntity?.order_id) {
      const payment = await prisma.payment.findUnique({
        where: { providerOrderId: paymentEntity.order_id },
        select: { id: true },
      });

      if (payment) {
        await fulfillPayment(payment.id, {
          providerPaymentId: paymentEntity.id,
        });
      }
    }

    if (event.event === "payment.failed" && paymentEntity?.order_id) {
      const payment = await prisma.payment.findUnique({
        where: { providerOrderId: paymentEntity.order_id },
        select: { id: true, status: true },
      });

      if (payment && payment.status === "PENDING") {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED" },
        });
      }
    }

    return res.status(200).json({ success: true });
  },
);
