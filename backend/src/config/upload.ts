import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import multer from "multer";
import { badRequest } from "../utils/AppError";

const UPLOAD_ROOT =
  process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

const storage = multer.diskStorage({
  destination: UPLOAD_ROOT,
  filename(_req, file, callback) {
    const ext = ALLOWED_MIME[file.mimetype];
    callback(null, `${crypto.randomBytes(16).toString("hex")}${ext}`);
  },
});

export const communityUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter(_req, file, callback) {
    if (!ALLOWED_MIME[file.mimetype]) {
      callback(
        badRequest(
          "Only image files (JPG, PNG, WebP, GIF) and video files (MP4, WebM, MOV) are allowed",
        ),
      );
      return;
    }
    callback(null, true);
  },
});

export const UPLOAD_ROOT_DIR = UPLOAD_ROOT;
export const UPLOAD_PUBLIC_PREFIX = "/uploads/";
