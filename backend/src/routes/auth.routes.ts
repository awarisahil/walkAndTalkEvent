import { Router } from "express";
import {
  login,
  logout,
  refresh,
  register,
} from "../controllers/auth.controller";
import { authRateLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

router.post("/register", authRateLimiter, register);
router.post("/login", authRateLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;
