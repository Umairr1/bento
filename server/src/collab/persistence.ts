import * as Y from "yjs";
import { db } from "../db";

db.exec(`
  CREATE TABLE IF NOT EXISTS board_snapshots (
    board_id INTEGER PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
    yjs_state BLOB NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

function boardIdFromDocName(docName: string): number | null {
  const match = /^board-(\d+)$/.exec(docName);
  return match ? Number(match[1]) : null;
}

export function loadSnapshot(docName: string, doc: Y.Doc) {
  const boardId = boardIdFromDocName(docName);
  if (boardId === null) return;
  const row = db.prepare("SELECT yjs_state FROM board_snapshots WHERE board_id = ?").get(boardId) as
    | { yjs_state: Buffer }
    | undefined;
  if (row) Y.applyUpdate(doc, row.yjs_state);
}

export function saveSnapshot(docName: string, doc: Y.Doc) {
  const boardId = boardIdFromDocName(docName);
  if (boardId === null) return;
  const state = Buffer.from(Y.encodeStateAsUpdate(doc));
  db.prepare(
    `INSERT INTO board_snapshots (board_id, yjs_state, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(board_id) DO UPDATE SET yjs_state = excluded.yjs_state, updated_at = excluded.updated_at`
  ).run(boardId, state);
}
