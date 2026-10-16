import { Router } from "express";
import {
  forgotPassword,
  login,
  logout,
  refresh,
  register,
  resetPassword,
  emailCode,
  emailLogin,
} from "../controllers/auth.controller";
import {
  authRateLimiter,
  passwordResetRateLimiter,
} from "../middleware/rateLimit.middleware";

const router = Router();

router.post("/register", authRateLimiter, register);
router.post("/login", authRateLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/forgot-password", passwordResetRateLimiter, forgotPassword);
router.post("/reset-password", passwordResetRateLimiter, resetPassword);
router.post("/email-code", passwordResetRateLimiter, emailCode);
router.post("/email-login", passwordResetRateLimiter, emailLogin);

export default router;
