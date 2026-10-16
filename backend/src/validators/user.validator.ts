import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters")
    .optional(),

  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .toLowerCase()
    .optional(),

  phone: z
    .string()
    .trim()
    .min(10, "Phone number must be at least 10 characters")
    .max(15, "Phone number must not exceed 15 characters")
    .nullish(),

  age: z
    .number()
    .int()
    .min(18, "You must be at least 18 years old")
    .max(100, "Invalid age")
    .nullish(),

  instagramUsername: z
    .string()
    .trim()
    .min(2, "Instagram username is required")
    .max(100, "Instagram username is too long")
    .transform((v) => v.replace(/^@/, ""))
    .optional(),

  instagramProfileUrl: z
    .string()
    .trim()
    .url("Invalid Instagram profile URL")
    .nullish(),

  linkedinProfileUrl: z
    .string()
    .trim()
    .url("Invalid LinkedIn profile URL")
    .nullish(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
