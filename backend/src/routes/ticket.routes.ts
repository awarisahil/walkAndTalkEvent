import { Router } from "express";
import {
  getMyTicketsController,
  getTicketByIdController,
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
  "/:id",
  authenticate,
  authorize("CUSTOMER"),
  getTicketByIdController,
);

export default router;