import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import { db } from "./db";
import { IS_PROD, UPLOADS_DIR, DATA_DIR } from "./config";
import authRouter from "./routes/auth";
import workspacesRouter from "./routes/workspaces";
import boardsRouter from "./routes/boards";
import uploadsRouter from "./routes/uploads";
import linkPreviewRouter from "./routes/linkPreview";
import sharingRouter from "./routes/sharing";
import { attachCollabServer } from "./collab";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

/**
 * In production the client is served by this same process, so requests are same-origin and CORS is
 * neither needed nor wanted. CLIENT_ORIGIN is only set when the client is hosted separately — in
 * dev that's Vite on :5173.
 */
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? (IS_PROD ? null : "http://localhost:5173");
if (CLIENT_ORIGIN) {
  app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
}

// Behind Railway/Fly/Cloudflare the app sees the proxy, not the visitor. Without this, req.ip and
// req.secure describe the proxy hop rather than the original request.
if (IS_PROD) app.set("trust proxy", 1);

app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  const row = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  res.json({ ok: true, userCount: row.count });
});

app.use("/uploads", express.static(UPLOADS_DIR));

app.use("/api/auth", authRouter);
app.use("/api/workspaces", workspacesRouter);
app.use("/api", boardsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/link-preview", linkPreviewRouter);
app.use("/api", sharingRouter);

/**
 * Serve the built client from this process when it's present (the production container build), so
 * the whole app is one origin: the auth cookie stays first-party and there is no CORS to configure.
 *
 * The fallback is a plain middleware rather than app.get("*") because Express 5 moved to
 * path-to-regexp v8, where a bare "*" is no longer a valid route pattern.
 */
const CLIENT_DIST = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path.startsWith("/yjs")) {
      return next();
    }
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
}

const server = http.createServer(app);
attachCollabServer(server);

server.listen(PORT, () => {
  console.log(`Boards server listening on :${PORT}`);
  console.log(`  mode      ${IS_PROD ? "production" : "development"}`);
  console.log(`  data dir  ${DATA_DIR}`);
  console.log(`  client    ${fs.existsSync(CLIENT_DIST) ? "served from " + CLIENT_DIST : "served separately (dev)"}`);
});
