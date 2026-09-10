import { Router } from "express";
import crypto from "node:crypto";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { getOwnedBoard, getBoardAccess, type SharableRole } from "../db/ownership";

const router = Router();
router.use(requireAuth);

const SHARABLE_ROLES = new Set<SharableRole>(["editor", "commenter", "viewer"]);

function isSharableRole(value: unknown): value is SharableRole {
  return typeof value === "string" && SHARABLE_ROLES.has(value as SharableRole);
}

// Boards the current user can access via a share (not ownership) — for the dashboard's "Shared with you" list.
router.get("/shared-boards", (req, res) => {
  const rows = db
    .prepare(
      `SELECT b.id, b.title, b.workspace_id, bm.role, w.name as workspaceName, u.name as ownerName
       FROM board_members bm
       JOIN boards b ON b.id = bm.board_id
       JOIN workspaces w ON w.id = b.workspace_id
       JOIN users u ON u.id = w.owner_id
       WHERE bm.user_id = ?
       ORDER BY bm.created_at DESC`
    )
    .all(req.user!.id);
  res.json(rows);
});

router.get("/boards/:id/members", (req, res) => {
  const access = getBoardAccess(Number(req.params.id), req.user!.id);
  if (!access) return res.status(404).json({ error: "Board not found" });

  const members = db
    .prepare(
      `SELECT u.id, u.name, u.email, bm.role
       FROM board_members bm JOIN users u ON u.id = bm.user_id
       WHERE bm.board_id = ? ORDER BY bm.created_at ASC`
    )
    .all(access.board.id);
  res.json(members);
});

router.post("/boards/:id/members", (req, res) => {
  const board = getOwnedBoard(Number(req.params.id), req.user!.id);
  if (!board) return res.status(404).json({ error: "Board not found" });

  const { email, role } = req.body ?? {};
  if (typeof email !== "string" || !email.trim()) return res.status(400).json({ error: "Enter an email address" });
  if (!isSharableRole(role)) return res.status(400).json({ error: "Choose a valid role" });

  const user = db.prepare("SELECT id, name, email FROM users WHERE email = ?").get(email.trim()) as
    | { id: number; name: string; email: string }
    | undefined;
  if (!user) {
    return res
      .status(404)
      .json({ error: "No account with that email yet — share the invite link instead so they can sign up and get access automatically" });
  }
  if (user.id === req.user!.id) return res.status(400).json({ error: "That's you — you already own this board" });

  db.prepare(
    `INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)
     ON CONFLICT(board_id, user_id) DO UPDATE SET role = excluded.role`
  ).run(board.id, user.id, role);

  res.status(201).json({ id: user.id, name: user.name, email: user.email, role });
});

router.patch("/boards/:id/members/:userId", (req, res) => {
  const board = getOwnedBoard(Number(req.params.id), req.user!.id);
  if (!board) return res.status(404).json({ error: "Board not found" });

  const { role } = req.body ?? {};
  if (!isSharableRole(role)) return res.status(400).json({ error: "Choose a valid role" });

  const result = db
    .prepare("UPDATE board_members SET role = ? WHERE board_id = ? AND user_id = ?")
    .run(role, board.id, Number(req.params.userId));
  if (result.changes === 0) return res.status(404).json({ error: "Member not found" });
  res.json({ ok: true });
});

router.delete("/boards/:id/members/:userId", (req, res) => {
  const board = getOwnedBoard(Number(req.params.id), req.user!.id);
  if (!board) return res.status(404).json({ error: "Board not found" });

  db.prepare("DELETE FROM board_members WHERE board_id = ? AND user_id = ?").run(board.id, Number(req.params.userId));
  res.json({ ok: true });
});

router.get("/boards/:id/invite-link", (req, res) => {
  const board = getOwnedBoard(Number(req.params.id), req.user!.id);
  if (!board) return res.status(404).json({ error: "Board not found" });

  const link = db.prepare("SELECT token, role FROM board_invite_links WHERE board_id = ?").get(board.id);
  res.json(link ?? null);
});

router.post("/boards/:id/invite-link", (req, res) => {
  const board = getOwnedBoard(Number(req.params.id), req.user!.id);
  if (!board) return res.status(404).json({ error: "Board not found" });

  const { role } = req.body ?? {};
  const grantedRole: SharableRole = isSharableRole(role) ? role : "editor";
  const token = crypto.randomBytes(18).toString("base64url");

  db.prepare(
    `INSERT INTO board_invite_links (board_id, token, role) VALUES (?, ?, ?)
     ON CONFLICT(board_id) DO UPDATE SET token = excluded.token, role = excluded.role`
  ).run(board.id, token, grantedRole);

  res.status(201).json({ token, role: grantedRole });
});

router.patch("/boards/:id/invite-link", (req, res) => {
  const board = getOwnedBoard(Number(req.params.id), req.user!.id);
  if (!board) return res.status(404).json({ error: "Board not found" });

  const { role } = req.body ?? {};
  if (!isSharableRole(role)) return res.status(400).json({ error: "Choose a valid role" });

  const result = db.prepare("UPDATE board_invite_links SET role = ? WHERE board_id = ?").run(role, board.id);
  if (result.changes === 0) return res.status(404).json({ error: "No invite link yet" });
  res.json({ ok: true });
});

router.delete("/boards/:id/invite-link", (req, res) => {
  const board = getOwnedBoard(Number(req.params.id), req.user!.id);
  if (!board) return res.status(404).json({ error: "Board not found" });

  db.prepare("DELETE FROM board_invite_links WHERE board_id = ?").run(board.id);
  res.json({ ok: true });
});

router.post("/join/:token", (req, res) => {
  const link = db.prepare("SELECT board_id, role FROM board_invite_links WHERE token = ?").get(req.params.token) as
    | { board_id: number; role: SharableRole }
    | undefined;
  if (!link) return res.status(404).json({ error: "This invite link is invalid or has been revoked" });

  const existingAccess = getBoardAccess(link.board_id, req.user!.id);
  if (existingAccess) {
    return res.json({ boardId: link.board_id, role: existingAccess.role });
  }

  db.prepare("INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)").run(
    link.board_id,
    req.user!.id,
    link.role
  );
  res.json({ boardId: link.board_id, role: link.role });
});

export default router;
