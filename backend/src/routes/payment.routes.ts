import { Router } from "express";
import {
  createPaymentController,
  createOrderController,
  verifyPaymentController,
  completePaymentController,
  getMyPaymentsController,
  getPaymentByIdController,
  getPaymentConfigController,
  listPaymentsForAdminController,
} from "../controllers/payment.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.get("/config", getPaymentConfigController);

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
  "/admin",
  authenticate,
  authorize("ADMIN"),
  listPaymentsForAdminController,
);
router.post(
  "/verify",
  authenticate,
  authorize("CUSTOMER"),
  verifyPaymentController,
);
router.get(
  "/:id",
  authenticate,
  authorize("CUSTOMER"),
  getPaymentByIdController,
);
router.post(
  "/:id/razorpay-order",
  authenticate,
  authorize("CUSTOMER"),
  createOrderController,
);

// DEV-ONLY payment simulation. Never mounted in production:
// a browser request must never be sufficient proof of payment.
if (process.env.NODE_ENV !== "production") {
  router.patch(
    "/:id/complete",
    authenticate,
    authorize("CUSTOMER"),
    completePaymentController,
  );
}

export default router;
