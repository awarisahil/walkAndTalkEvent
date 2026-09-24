import { Router } from "express";
import {
  createTicketRequestController,
  getTicketRequestsForAdminController,
  approveTicketRequestController,
  rejectTicketRequestController,
  getMyTicketRequestsController,
  getMyPaymentPendingRequestsController
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


export default router;