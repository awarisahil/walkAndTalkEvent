import { Router } from "express";
import {
  listCommunityPostsController,
  createCommunityPostController,
  deleteCommunityPostController,
} from "../controllers/community.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.get("/", listCommunityPostsController);
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  createCommunityPostController,
);
router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  deleteCommunityPostController,
);

export default router;
