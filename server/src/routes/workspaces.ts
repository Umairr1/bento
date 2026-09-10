import { Router } from "express";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { getOwnedWorkspace } from "../db/ownership";

const router = Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT w.*, (
         SELECT COUNT(*) FROM boards b WHERE b.workspace_id = w.id AND b.parent_board_id IS NULL
       ) as boardCount
       FROM workspaces w WHERE w.owner_id = ? ORDER BY w.created_at DESC`
    )
    .all(req.user!.id);
  res.json(rows);
});

router.post("/", (req, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Enter a workspace name" });
  }
  const trimmed = name.trim();
  const result = db.prepare("INSERT INTO workspaces (name, owner_id) VALUES (?, ?)").run(trimmed, req.user!.id);
  const workspace = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(workspace);
});

router.patch("/:id", (req, res) => {
  const workspace = getOwnedWorkspace(Number(req.params.id), req.user!.id);
  if (!workspace) return res.status(404).json({ error: "Workspace not found" });

  const { name } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Enter a workspace name" });
  }
  db.prepare("UPDATE workspaces SET name = ? WHERE id = ?").run(name.trim(), workspace.id);
  res.json({ ...workspace, name: name.trim() });
});

router.delete("/:id", (req, res) => {
  const workspace = getOwnedWorkspace(Number(req.params.id), req.user!.id);
  if (!workspace) return res.status(404).json({ error: "Workspace not found" });

  db.prepare("DELETE FROM workspaces WHERE id = ?").run(workspace.id);
  res.json({ ok: true });
});

export default router;
