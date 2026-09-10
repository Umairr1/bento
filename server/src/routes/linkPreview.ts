import { Router } from "express";
import * as cheerio from "cheerio";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();
router.use(requireAuth);

const PRIVATE_HOST_RE =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|::1|\[::1\])/i;
const PRIVATE_172_RE = /^172\.(1[6-9]|2\d|3[0-1])\./;

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return PRIVATE_HOST_RE.test(h) || PRIVATE_172_RE.test(h) || h.endsWith(".local");
}

router.get("/", async (req, res) => {
  const raw = typeof req.query.url === "string" ? req.query.url : "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return res.status(400).json({ error: "Enter a valid URL" });
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return res.status(400).json({ error: "Only http/https links are supported" });
  }
  if (isBlockedHost(target.hostname)) {
    return res.status(400).json({ error: "That host can't be previewed" });
  }

  const fallback = { url: target.toString(), title: target.hostname, description: null, image: null };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BoardsLinkPreview/1.0)" },
    });
    clearTimeout(timeout);

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) {
      return res.json(fallback);
    }

    let html = await response.text();
    if (html.length > 2_000_000) html = html.slice(0, 2_000_000);

    const $ = cheerio.load(html);
    const metaContent = (name: string) =>
      $(`meta[property="${name}"]`).attr("content") ?? $(`meta[name="${name}"]`).attr("content");

    const title = metaContent("og:title") || $("title").first().text().trim() || target.hostname;
    const description = metaContent("og:description") || metaContent("description") || null;
    const rawImage = metaContent("og:image");
    const image = rawImage ? new URL(rawImage, target.toString()).toString() : null;

    res.json({ url: target.toString(), title, description, image });
  } catch {
    clearTimeout(timeout);
    res.json(fallback);
  }
});

export default router;
