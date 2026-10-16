import { z } from "zod";

export const guestJoinSchema = z.object({
  eventId: z.string().trim().min(1, "Event is required"),

  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters"),

  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .toLowerCase(),

  phone: z
    .string()
    .trim()
    .min(10, "Phone number must be at least 10 characters")
    .max(15, "Phone number must not exceed 15 characters"),

  instagramUsername: z
    .string()
    .trim()
    .min(2, "Instagram profile is required")
    .max(100, "Instagram username is too long")
    .transform((v) => v.replace(/^@/, "")),

  instagramProfileUrl: z
    .string()
    .trim()
    .url("Invalid Instagram profile URL")
    .optional(),

  linkedinProfileUrl: z
    .string()
    .trim()
    .url("Invalid LinkedIn profile URL")
    .optional(),

  age: z
    .number()
    .int()
    .min(18, "You must be at least 18 years old")
    .max(100, "Invalid age"),
});

export type GuestJoinInput = z.infer<typeof guestJoinSchema>;
