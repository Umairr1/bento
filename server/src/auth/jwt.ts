import jwt from "jsonwebtoken";

function loadSecret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not set — check server/.env");
  return value;
}

const JWT_SECRET: string = loadSecret();

export type AuthTokenPayload = { userId: number };

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "string" || typeof decoded.userId !== "number") return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

export const AUTH_COOKIE_NAME = "boards_token";
export const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
