import { Router } from "express";
import {
  authenticate,
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.get(
  "/me",
  authenticate,
  (req: AuthenticatedRequest, res) => {
    return res.status(200).json({
      success: true,
      data: {
        userId: req.user?.userId,
        role: req.user?.role,
      },
    });
  },
);

router.get(
  "/admin-test",
  authenticate,
  authorize("ADMIN"),
  (_req, res) => {
    return res.status(200).json({
      success: true,
      message: "You have admin access",
    });
  },
);

router.get(
  "/customer-test",
  authenticate,
  authorize("CUSTOMER"),
  (_req, res) => {
    return res.status(200).json({
      success: true,
      message: "You have customer access",
    });
  },
);

export default router;