import { Router } from "express";
import {
  createTicketRequestController,
  getTicketRequestByIdController,
  getTicketRequestsForAdminController,
  approveTicketRequestController,
  rejectTicketRequestController,
  cancelTicketRequestController,
  getMyTicketRequestsController,
  getMyPaymentPendingRequestsController,
} from "../controllers/ticketRequest.controller";
import { guestJoinController } from "../controllers/guestJoin.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { passwordResetRateLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

// Public guest "Request to Join" (Luma-style; no account needed)
router.post("/guest", passwordResetRateLimiter, guestJoinController);

router.post(
  "/",
  authenticate,
  authorize("CUSTOMER"),
  createTicketRequestController,
);
router.get(
  "/my",
  authenticate,
  authorize("CUSTOMER"),
  getMyTicketRequestsController,
);
router.get(
  "/my/payment-pending",
  authenticate,
  authorize("CUSTOMER"),
  getMyPaymentPendingRequestsController,
);
router.get(
  "/admin",
  authenticate,
  authorize("ADMIN"),
  getTicketRequestsForAdminController,
);
router.patch(
  "/:id/approve",
  authenticate,
  authorize("ADMIN"),
  approveTicketRequestController,
);
router.patch(
  "/:id/reject",
  authenticate,
  authorize("ADMIN"),
  rejectTicketRequestController,
);
router.patch(
  "/:id/cancel",
  authenticate,
  authorize("CUSTOMER"),
  cancelTicketRequestController,
);
router.get(
  "/:id",
  authenticate,
  getTicketRequestByIdController,
);

export default router;
