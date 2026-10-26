import { Router } from "express";
import {
  getInviteStateController,
  invitePayController,
  inviteUpiQrController,
  inviteVerifyController,
  inviteDevCompleteController,
} from "../controllers/invite.controller";
import { passwordResetRateLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

// Invite-scoped payment flow (token in the approval email)
router.get("/:token", getInviteStateController);
router.post("/:token/pay", invitePayController);
router.post("/:token/upi-qr", inviteUpiQrController);
router.post("/:token/verify", inviteVerifyController);

if (process.env.NODE_ENV !== "production") {
  router.post("/:token/dev-complete", inviteDevCompleteController);
}

export default router;
