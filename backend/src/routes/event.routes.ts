import { Router } from "express";
import {
  createEventController,
  updateEventController,
  getEventsController,
  getEventByIdController,
  cancelEventController,
  publishEventController,
  completeEventController,
} from "../controllers/event.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();
router.get("/", getEventsController);

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  createEventController,
);
router.patch(
  "/:id/complete",
  authenticate,
  authorize("ADMIN"),
  completeEventController,
);
router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  updateEventController,
);
router.patch(
  "/:id/cancel",
  authenticate,
  authorize("ADMIN"),
  cancelEventController,
);
router.patch(
  "/:id/publish",
  authenticate,
  authorize("ADMIN"),
  publishEventController,
);

router.get("/:id", getEventByIdController);

export default router;