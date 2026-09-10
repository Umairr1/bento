import { db } from "./index";
import type { BoardRow, WorkspaceRow } from "./types";

export type BoardRole = "owner" | "editor" | "commenter" | "viewer";
export type SharableRole = Exclude<BoardRole, "owner">;

export function getOwnedWorkspace(workspaceId: number, userId: number): WorkspaceRow | undefined {
  return db.prepare("SELECT * FROM workspaces WHERE id = ? AND owner_id = ?").get(workspaceId, userId) as
    | WorkspaceRow
    | undefined;
}

export function getOwnedBoard(boardId: number, userId: number): BoardRow | undefined {
  return db
    .prepare(
      `SELECT b.* FROM boards b
       JOIN workspaces w ON w.id = b.workspace_id
       WHERE b.id = ? AND w.owner_id = ?`
    )
    .get(boardId, userId) as BoardRow | undefined;
}

/** Resolves a user's access to a board — via workspace ownership, or a board_members grant. Null if neither. */
export function getBoardAccess(boardId: number, userId: number): { board: BoardRow; role: BoardRole } | null {
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(boardId) as BoardRow | undefined;
  if (!board) return null;

  const workspace = db.prepare("SELECT owner_id FROM workspaces WHERE id = ?").get(board.workspace_id) as
    | { owner_id: number }
    | undefined;
  if (workspace && workspace.owner_id === userId) return { board, role: "owner" };

  const member = db.prepare("SELECT role FROM board_members WHERE board_id = ? AND user_id = ?").get(boardId, userId) as
    | { role: SharableRole }
    | undefined;
  if (member) return { board, role: member.role };

  return null;
}

export function canEditRole(role: BoardRole): boolean {
  return role === "owner" || role === "editor";
}
