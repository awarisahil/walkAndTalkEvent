export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    options?: { code?: string; details?: unknown },
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = options?.code ?? "APP_ERROR";
    this.details = options?.details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, message, { code: "BAD_REQUEST", details });

export const unauthorized = (message = "Authentication required") =>
  new AppError(401, message, { code: "UNAUTHORIZED" });

export const forbidden = (message = "You do not have permission to perform this action") =>
  new AppError(403, message, { code: "FORBIDDEN" });

export const notFound = (message = "Resource not found") =>
  new AppError(404, message, { code: "NOT_FOUND" });

export const conflict = (message: string) =>
  new AppError(409, message, { code: "CONFLICT" });
