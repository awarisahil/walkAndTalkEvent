import { z } from "zod";

export const createEventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must not exceed 200 characters"),

  description: z
    .string()
    .trim()
    .max(5000, "Description must not exceed 5000 characters")
    .optional(),

  image: z
    .string()
    .trim()
    .url("Invalid image URL")
    .optional(),

  date: z
    .string()
    .datetime("Invalid event date"),

  startTime: z
    .string()
    .trim()
    .max(20, "Start time is too long")
    .optional(),

  endTime: z
    .string()
    .trim()
    .max(20, "End time is too long")
    .optional(),

  venue: z
    .string()
    .trim()
    .min(2, "Venue is required")
    .max(300, "Venue must not exceed 300 characters"),

  ticketPrice: z
    .number()
    .nonnegative("Ticket price cannot be negative"),

  capacity: z
    .number()
    .int()
    .positive("Capacity must be greater than 0"),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export const updateEventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must not exceed 200 characters")
    .optional(),

  description: z
    .string()
    .trim()
    .max(5000, "Description must not exceed 5000 characters")
    .optional(),

  image: z
    .string()
    .trim()
    .url("Invalid image URL")
    .optional(),

  date: z
    .string()
    .datetime("Invalid event date")
    .optional(),

  startTime: z
    .string()
    .trim()
    .max(20, "Start time is too long")
    .optional(),

  endTime: z
    .string()
    .trim()
    .max(20, "End time is too long")
    .optional(),

  venue: z
    .string()
    .trim()
    .min(2, "Venue is required")
    .max(300, "Venue must not exceed 300 characters")
    .optional(),

  ticketPrice: z
    .number()
    .nonnegative("Ticket price cannot be negative")
    .optional(),

  capacity: z
    .number()
    .int()
    .positive("Capacity must be greater than 0")
    .optional(),
});

export type UpdateEventInput = z.infer<typeof updateEventSchema>;