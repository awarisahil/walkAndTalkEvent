import { Router } from "express";
import {
  createEventController,
  updateEventController,
  getEventsController,
  getAdminEventsController,
  getEventByIdController,
  getAdminEventByIdController,
  cancelEventController,
  publishEventController,
  completeEventController,
  getEventAttendeesController,
  exportEventAttendeesController,
} from "../controllers/event.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.get("/", getEventsController);

router.get(
  "/admin",
  authenticate,
  authorize("ADMIN"),
  getAdminEventsController,
);
router.get(
  "/admin/:id",
  authenticate,
  authorize("ADMIN"),
  getAdminEventByIdController,
);

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
router.get(
  "/:id/attendees",
  authenticate,
  authorize("ADMIN"),
  getEventAttendeesController,
);
router.get(
  "/:id/attendees/export",
  authenticate,
  authorize("ADMIN"),
  exportEventAttendeesController,
);
router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  updateEventController,
);

router.get("/:id", getEventByIdController);

export default router;
