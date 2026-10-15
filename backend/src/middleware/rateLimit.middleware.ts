import rateLimit from "express-rate-limit";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // Tests share one IP (127.0.0.1) and would trip the limiter as the
  // suite grows.
  skip: () => process.env.NODE_ENV === "test",
  message: {
    success: false,
    message: "Too many attempts, please try again later",
  },
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: {
    success: false,
    message: "Too many attempts, please try again later",
  },
});
