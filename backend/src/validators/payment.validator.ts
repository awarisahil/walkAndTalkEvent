import { z } from "zod";

export const createPaymentSchema = z.object({
  ticketRequestId: z
    .string()
    .trim()
    .min(1, "Ticket request ID is required"),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;