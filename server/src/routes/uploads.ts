import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { requireAuth } from "../middleware/requireAuth";

const uploadsDir = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);
const ALLOWED_VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/quicktime", "video/ogg"]);
const ALLOWED_MIME = new Set([...ALLOWED_IMAGE_MIME, ...ALLOWED_VIDEO_MIME]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIME.has(file.mimetype));
  },
});

const router = Router();
router.use(requireAuth);

router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Upload a PNG, JPEG, GIF, WEBP, SVG image or MP4, WEBM, MOV video (max 150MB)" });
  }
  const kind = ALLOWED_VIDEO_MIME.has(req.file.mimetype) ? "video" : "image";
  res.status(201).json({ url: `/uploads/${req.file.filename}`, kind });
});

export default router;
