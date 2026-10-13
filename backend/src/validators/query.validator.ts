import { z } from "zod";

export const eventQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

export const adminEventQuerySchema = eventQuerySchema.extend({
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"]).optional(),
});

export const adminRequestQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  eventId: z.string().trim().optional(),
  status: z
    .enum([
      "PENDING",
      "APPROVED",
      "REJECTED",
      "PAYMENT_PENDING",
      "PAID",
      "CANCELLED",
      "EXPIRED",
    ])
    .optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

export const adminPaymentQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  eventId: z.string().trim().optional(),
  status: z.enum(["PENDING", "SUCCESS", "FAILED", "REFUNDED"]).optional(),
});

export const attendeeQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(["ACTIVE", "USED", "CANCELLED"]).optional(),
});

export const checkInSchema = z
  .object({
    ticketNumber: z.string().trim().min(1).max(50).optional(),
    qrToken: z.string().trim().min(1).max(200).optional(),
    eventId: z.string().trim().min(1).optional(),
  })
  .refine((v) => v.ticketNumber || v.qrToken, {
    message: "Provide a ticket number or scan a QR code",
  });

export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().trim().min(1, "Order ID is required"),
  razorpayPaymentId: z.string().trim().min(1, "Payment ID is required"),
  razorpaySignature: z.string().trim().min(1, "Signature is required"),
});

export type EventQueryInput = z.infer<typeof eventQuerySchema>;
export type AdminEventQueryInput = z.infer<typeof adminEventQuerySchema>;
export type AdminRequestQueryInput = z.infer<
  typeof adminRequestQuerySchema
>;
export type AdminPaymentQueryInput = z.infer<
  typeof adminPaymentQuerySchema
>;
export type AttendeeQueryInput = z.infer<typeof attendeeQuerySchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
