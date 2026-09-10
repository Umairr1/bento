import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { AUTH_COOKIE_MAX_AGE_MS, AUTH_COOKIE_NAME, signToken } from "../auth/jwt";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: AUTH_COOKIE_MAX_AGE_MS,
};

type UserRow = { id: number; email: string; name: string; password_hash: string };

router.post("/signup", async (req, res) => {
  const { email, password, name } = req.body ?? {};

  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "Enter your name" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = db
    .prepare("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)")
    .run(email, passwordHash, name.trim());

  const token = signToken({ userId: Number(result.lastInsertRowid) });
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
  res.status(201).json({ id: result.lastInsertRowid, email, name: name.trim() });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Invalid email or password" });
  }

  const user = db.prepare("SELECT id, email, name, password_hash FROM users WHERE email = ?").get(email) as
    | UserRow
    | undefined;

  const passwordMatches = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !passwordMatches) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken({ userId: user.id });
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
  res.json({ id: user.id, email: user.email, name: user.name });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, cookieOptions);
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

export default router;
