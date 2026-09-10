import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import http from "node:http";
import { db } from "./db";
import authRouter from "./routes/auth";
import workspacesRouter from "./routes/workspaces";
import boardsRouter from "./routes/boards";
import uploadsRouter from "./routes/uploads";
import linkPreviewRouter from "./routes/linkPreview";
import sharingRouter from "./routes/sharing";
import { attachCollabServer } from "./collab";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  const row = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  res.json({ ok: true, userCount: row.count });
});

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use("/api/auth", authRouter);
app.use("/api/workspaces", workspacesRouter);
app.use("/api", boardsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/link-preview", linkPreviewRouter);
app.use("/api", sharingRouter);

const server = http.createServer(app);
attachCollabServer(server);

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
