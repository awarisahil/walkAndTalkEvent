import { z } from "zod";

export const registerSchema = z.object({
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
    .max(15, "Phone number must not exceed 15 characters")
    .optional(),

  age: z
    .number()
    .int()
    .min(18, "You must be at least 18 years old")
    .max(100, "Invalid age")
    .optional(),

  instagramUsername: z
    .string()
    .trim()
    .min(2, "Instagram username is required")
    .max(100, "Instagram username is too long")
    .transform((v) => v.replace(/^@/, "")),

  instagramProfileUrl: z
    .string()
    .trim()
    .url("Invalid Instagram profile URL")
    .optional(),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters"),
});
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .toLowerCase(),

  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password is too long"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().trim().min(10, "Refresh token is required"),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .toLowerCase(),
});

export const resetPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .toLowerCase(),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;