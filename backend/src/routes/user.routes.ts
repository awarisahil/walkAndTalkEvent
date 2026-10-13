import { Router } from "express";
import {
  getMeController,
  updateMeController,
} from "../controllers/user.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/me", authenticate, getMeController);
router.patch("/me", authenticate, updateMeController);

export default router;
