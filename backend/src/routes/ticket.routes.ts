import { Router } from "express";
import {
  getMyTicketsController,
  getTicketByIdController,
  lookupTicketController,
  checkInTicketController,
} from "../controllers/ticket.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.get(
  "/my",
  authenticate,
  authorize("CUSTOMER"),
  getMyTicketsController,
);
router.get(
  "/lookup",
  authenticate,
  authorize("ADMIN"),
  lookupTicketController,
);
router.post(
  "/check-in",
  authenticate,
  authorize("ADMIN"),
  checkInTicketController,
);
router.get(
  "/:id",
  authenticate,
  authorize("CUSTOMER"),
  getTicketByIdController,
);

export default router;
