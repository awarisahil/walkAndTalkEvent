import { Router } from "express";
import { createEventController } from "../controllers/event.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  createEventController,
);

export default router;