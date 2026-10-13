import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";

export function notFoundHandler(
  _req: Request,
  res: Response,
) {
  return res.status(404).json({
    success: false,
    message: "Route not found",
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    const body: Record<string, unknown> = {
      success: false,
      message: err.message,
      code: err.code,
    };
    if (err.details !== undefined) body.errors = err.details;
    return res.status(err.statusCode).json(body);
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      errors: err.flatten(),
    });
  }

  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code?: unknown }).code === "string"
  ) {
    const prismaError = err as { code: string; message?: string };

    if (prismaError.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A record with this information already exists",
        code: "DUPLICATE",
      });
    }

    if (prismaError.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Record not found",
        code: "NOT_FOUND",
      });
  }

    if (prismaError.code === "P2034") {
      return res.status(409).json({
        success: false,
        message: "The resource was modified concurrently, please retry",
        code: "CONFLICT",
      });
    }
  }

  console.error("Unhandled error:", err);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
    code: "INTERNAL_ERROR",
  });
}
