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
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

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
