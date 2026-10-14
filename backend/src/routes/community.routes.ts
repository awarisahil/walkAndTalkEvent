import { Router } from "express";
import {
  listCommunityPostsController,
  createCommunityPostController,
  deleteCommunityPostController,
  uploadCommunityMediaController,
} from "../controllers/community.controller";
import { communityUpload } from "../config/upload";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.get("/", listCommunityPostsController);
router.post(
  "/upload",
  authenticate,
  authorize("ADMIN"),
  communityUpload.single("file"),
  uploadCommunityMediaController,
);
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
