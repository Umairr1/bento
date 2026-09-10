import { Router } from "express";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { getOwnedBoard, getOwnedWorkspace, getBoardAccess, canEditRole } from "../db/ownership";

const router = Router();
router.use(requireAuth);

router.get("/workspaces/:workspaceId/boards", (req, res) => {
  const workspace = getOwnedWorkspace(Number(req.params.workspaceId), req.user!.id);
  if (!workspace) return res.status(404).json({ error: "Workspace not found" });

  const boards = db
    .prepare(
      `SELECT id, workspace_id, parent_board_id, title, created_by, created_at
       FROM boards WHERE workspace_id = ? AND parent_board_id IS NULL ORDER BY created_at DESC`
    )
    .all(workspace.id);
  res.json(boards);
});

router.get("/boards/:id", (req, res) => {
  const access = getBoardAccess(Number(req.params.id), req.user!.id);
  if (!access) return res.status(404).json({ error: "Board not found" });
  const { board, role } = access;

  let content: unknown = {};
  try {
    content = JSON.parse(board.content);
  } catch {
    content = {};
  }

  const parent = board.parent_board_id
    ? (db.prepare("SELECT id, title FROM boards WHERE id = ?").get(board.parent_board_id) as
        | { id: number; title: string }
        | undefined)
    : null;

  res.json({ ...board, content, parentTitle: parent?.title ?? null, role });
});

router.get("/boards/:id/subboards", (req, res) => {
  const access = getBoardAccess(Number(req.params.id), req.user!.id);
  if (!access) return res.status(404).json({ error: "Board not found" });

  const subboards = db
    .prepare(
      `SELECT id, workspace_id, parent_board_id, title, created_by, created_at
       FROM boards WHERE parent_board_id = ? ORDER BY created_at DESC`
    )
    .all(access.board.id);
  res.json(subboards);
});

router.post("/boards/:id/subboards", (req, res) => {
  const access = getBoardAccess(Number(req.params.id), req.user!.id);
  if (!access) return res.status(404).json({ error: "Board not found" });
  if (!canEditRole(access.role)) return res.status(403).json({ error: "You don't have permission to add boards here" });

  const { title } = req.body ?? {};
  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Enter a board title" });
  }

  const result = db
    .prepare("INSERT INTO boards (workspace_id, parent_board_id, title, created_by) VALUES (?, ?, ?, ?)")
    .run(access.board.workspace_id, access.board.id, title.trim(), req.user!.id);
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(board);
});

router.put("/boards/:id/content", (req, res) => {
  const access = getBoardAccess(Number(req.params.id), req.user!.id);
  if (!access) return res.status(404).json({ error: "Board not found" });
  if (!canEditRole(access.role)) return res.status(403).json({ error: "You don't have permission to edit this board" });

  const { content } = req.body ?? {};
  if (typeof content !== "object" || content === null) {
    return res.status(400).json({ error: "Invalid board content" });
  }
  db.prepare("UPDATE boards SET content = ? WHERE id = ?").run(JSON.stringify(content), access.board.id);
  res.json({ ok: true });
});

router.post("/workspaces/:workspaceId/boards", (req, res) => {
  const workspace = getOwnedWorkspace(Number(req.params.workspaceId), req.user!.id);
  if (!workspace) return res.status(404).json({ error: "Workspace not found" });

  const { title } = req.body ?? {};
  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Enter a board title" });
  }

  const result = db
    .prepare("INSERT INTO boards (workspace_id, title, created_by) VALUES (?, ?, ?)")
    .run(workspace.id, title.trim(), req.user!.id);
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(board);
});

router.patch("/boards/:id", (req, res) => {
  const board = getOwnedBoard(Number(req.params.id), req.user!.id);
  if (!board) return res.status(404).json({ error: "Board not found" });

  const { title } = req.body ?? {};
  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Enter a board title" });
  }
  db.prepare("UPDATE boards SET title = ? WHERE id = ?").run(title.trim(), board.id);
  res.json({ ...board, title: title.trim() });
});

router.delete("/boards/:id", (req, res) => {
  const board = getOwnedBoard(Number(req.params.id), req.user!.id);
  if (!board) return res.status(404).json({ error: "Board not found" });

  db.prepare("DELETE FROM boards WHERE id = ?").run(board.id);
  res.json({ ok: true });
});

export default router;
