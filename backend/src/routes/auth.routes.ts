import { Router } from "express";
import { login, register } from "../controllers/auth.controller";
import { authRateLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

router.post("/register", authRateLimiter, register);
router.post("/login", authRateLimiter, login);

export default router;
