import { z } from "zod";

export const createTicketRequestSchema = z.object({
  eventId: z
    .string()
    .trim()
    .min(1, "Event ID is required"),
});

export type CreateTicketRequestInput = z.infer<
  typeof createTicketRequestSchema
>;
export const rejectTicketRequestSchema = z.object({
  rejectionReason: z
    .string()
    .trim()
    .min(1, "Rejection reason is required")
    .max(500, "Rejection reason must not exceed 500 characters"),
});

export type RejectTicketRequestInput = z.infer<
  typeof rejectTicketRequestSchema
>;