import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE_NAME, verifyToken } from "../auth/jwt";
import { db } from "../db";

export type AuthedUser = { id: number; email: string; name: string };

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const user = db
    .prepare("SELECT id, email, name FROM users WHERE id = ?")
    .get(payload.userId) as AuthedUser | undefined;

  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  req.user = user;
  next();
}
