import { Router } from "express";
import {
  createPaymentController,
  getMyPaymentsController,
  getPaymentByIdController,
  completePaymentController,
} from "../controllers/payment.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("CUSTOMER"),
  createPaymentController,
);

router.get(
  "/my",
  authenticate,
  authorize("CUSTOMER"),
  getMyPaymentsController,
);

router.get(
  "/:id",
  authenticate,
  authorize("CUSTOMER"),
  getPaymentByIdController,
);
router.patch(
  "/:id/complete",
  authenticate,
  authorize("CUSTOMER"),
  completePaymentController,
);

export default router;