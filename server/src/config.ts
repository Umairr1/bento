import path from "node:path";
import fs from "node:fs";

export const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Everything that has to survive a redeploy lives under DATA_DIR: the SQLite file and uploaded
 * media. On a container host (Railway, Fly, Render) this MUST point at a mounted volume — a
 * container's own filesystem is rebuilt on every deploy, which would silently take the whole
 * database and every uploaded image with it.
 *
 * Defaults to the server package root, which is where the dev setup has always kept them.
 */
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..");

export const DB_PATH = path.join(DATA_DIR, "data.sqlite3");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
