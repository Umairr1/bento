import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError, type Board, type SharedBoard, type Workspace } from "../api/client";
import "./Dashboard.css";

/** Sentinel workspace id for the "Shared with you" pseudo-workspace — boards you don't own. */
const SHARED_WS = -1;

export default function Dashboard() {
  const { user, logout } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [renamingWorkspaceId, setRenamingWorkspaceId] = useState<number | null>(null);
  const [renameWorkspaceValue, setRenameWorkspaceValue] = useState("");

  const [boards, setBoards] = useState<Board[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [renamingBoardId, setRenamingBoardId] = useState<number | null>(null);
  const [renameBoardValue, setRenameBoardValue] = useState("");

  const [sharedBoards, setSharedBoards] = useState<SharedBoard[]>([]);

  const [error, setError] = useState<string | null>(null);

  function showError(err: unknown) {
    setError(err instanceof ApiError ? err.message : "Something went wrong");
  }

  async function loadWorkspaces() {
    setWorkspacesLoading(true);
    try {
      const list = await api.listWorkspaces();
      setWorkspaces(list);
      setSelectedId((prev) => (prev && list.some((w) => w.id === prev) ? prev : (list[0]?.id ?? null)));
    } catch (err) {
      showError(err);
    } finally {
      setWorkspacesLoading(false);
    }
  }

  useEffect(() => {
    loadWorkspaces();
    // Boards other people shared in live outside your own workspaces, so they get their own list
    // rather than being folded into one — a failure here shouldn't blank the whole dashboard.
    api.listSharedBoards().then(setSharedBoards).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedId === null || selectedId === SHARED_WS) {
      setBoards([]);
      return;
    }
    setBoardsLoading(true);
    api
      .listBoards(selectedId)
      .then(setBoards)
      .catch(showError)
      .finally(() => setBoardsLoading(false));
  }, [selectedId]);

  async function handleCreateWorkspace(e: FormEvent) {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setError(null);
    try {
      const ws = await api.createWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName("");
      setCreatingWorkspace(false);
      setWorkspaces((prev) => [{ ...ws, boardCount: 0 }, ...prev]);
      setSelectedId(ws.id);
    } catch (err) {
      showError(err);
    }
  }

  async function handleRenameWorkspace(id: number) {
    if (!renameWorkspaceValue.trim()) return;
    setError(null);
    try {
      const updated = await api.renameWorkspace(id, renameWorkspaceValue.trim());
      setWorkspaces((prev) => prev.map((w) => (w.id === id ? { ...w, name: updated.name } : w)));
      setRenamingWorkspaceId(null);
    } catch (err) {
      showError(err);
    }
  }

  async function handleDeleteWorkspace(id: number) {
    if (!confirm("Delete this workspace and all its boards? This can't be undone.")) return;
    setError(null);
    try {
      await api.deleteWorkspace(id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      setSelectedId((prev) => (prev === id ? null : prev));
    } catch (err) {
      showError(err);
    }
  }

  async function handleCreateBoard(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || !newBoardTitle.trim()) return;
    setError(null);
    try {
      const board = await api.createBoard(selectedId, newBoardTitle.trim());
      setBoards((prev) => [board, ...prev]);
      setNewBoardTitle("");
      setCreatingBoard(false);
      setWorkspaces((prev) => prev.map((w) => (w.id === selectedId ? { ...w, boardCount: w.boardCount + 1 } : w)));
    } catch (err) {
      showError(err);
    }
  }

  async function handleRenameBoard(id: number) {
    if (!renameBoardValue.trim()) return;
    setError(null);
    try {
      const updated = await api.renameBoard(id, renameBoardValue.trim());
      setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, title: updated.title } : b)));
      setRenamingBoardId(null);
    } catch (err) {
      showError(err);
    }
  }

  async function handleDeleteBoard(id: number) {
    if (!confirm("Delete this board? This can't be undone.")) return;
    setError(null);
    try {
      await api.deleteBoard(id);
      setBoards((prev) => prev.filter((b) => b.id !== id));
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === selectedId ? { ...w, boardCount: Math.max(0, w.boardCount - 1) } : w))
      );
    } catch (err) {
      showError(err);
    }
  }

  const selectedWorkspace = workspaces.find((w) => w.id === selectedId) ?? null;

  return (
    <div className="dash">
      <header className="dash-header">
        <h1>Boards</h1>
        <div className="dash-user">
          <span>Logged in as {user?.name}</span>
          <button className="btn small" onClick={() => logout()}>
            Log out
          </button>
        </div>
      </header>

      {error && (
        <div style={{ background: "rgba(240,96,122,.12)", color: "#f0607a", padding: "8px 20px", fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="dash-body">
        <aside className="ws-panel">
          <h2>Workspaces</h2>

          {workspacesLoading && <div className="empty-state">Loading…</div>}
          {!workspacesLoading && workspaces.length === 0 && !creatingWorkspace && (
            <div className="empty-state">No workspaces yet.</div>
          )}

          {workspaces.map((ws) =>
            renamingWorkspaceId === ws.id ? (
              <div className="inline-form" key={ws.id}>
                <input
                  autoFocus
                  value={renameWorkspaceValue}
                  onChange={(e) => setRenameWorkspaceValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRenameWorkspace(ws.id)}
                />
                <button className="btn small" onClick={() => handleRenameWorkspace(ws.id)}>
                  Save
                </button>
                <button className="btn small" onClick={() => setRenamingWorkspaceId(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <div
                key={ws.id}
                className={`ws-item ${ws.id === selectedId ? "active" : ""}`}
                onClick={() => setSelectedId(ws.id)}
              >
                <span>{ws.name}</span>
                <span className="count">{ws.boardCount}</span>
              </div>
            )
          )}

          {sharedBoards.length > 0 && (
            <div
              className={`ws-item ${selectedId === SHARED_WS ? "active" : ""}`}
              style={{ marginTop: 10 }}
              onClick={() => setSelectedId(SHARED_WS)}
            >
              <span>Shared with you</span>
              <span className="count">{sharedBoards.length}</span>
            </div>
          )}

          {creatingWorkspace ? (
            <form className="inline-form" onSubmit={handleCreateWorkspace}>
              <input
                autoFocus
                placeholder="Workspace name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
              />
              <button className="btn small primary" type="submit">
                Add
              </button>
            </form>
          ) : (
            <button className="btn small" style={{ marginTop: 12, width: "100%" }} onClick={() => setCreatingWorkspace(true)}>
              + New workspace
            </button>
          )}
        </aside>

        <section className="boards-panel">
          {selectedId === SHARED_WS ? (
            <>
              <div className="panel-head">
                <h2>Shared with you</h2>
              </div>
              <div className="board-grid">
                {sharedBoards.map((b) => (
                  <div className="board-card" key={b.id}>
                    <div className="title">{b.title}</div>
                    <div className="shared-meta">
                      {b.ownerName} · {b.workspaceName} · {b.role}
                    </div>
                    <div className="actions">
                      <Link className="btn small primary" to={`/board/${b.id}`}>
                        Open
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : !selectedWorkspace ? (
            <div className="empty-state">Create a workspace to get started.</div>
          ) : (
            <>
              <div className="panel-head">
                <h2>{selectedWorkspace.name}</h2>
                <div className="ws-actions">
                  <button
                    className="btn small"
                    onClick={() => {
                      setRenamingWorkspaceId(selectedWorkspace.id);
                      setRenameWorkspaceValue(selectedWorkspace.name);
                    }}
                  >
                    Rename
                  </button>
                  <button className="btn small danger" onClick={() => handleDeleteWorkspace(selectedWorkspace.id)}>
                    Delete workspace
                  </button>
                </div>
              </div>

              {creatingBoard ? (
                <form className="inline-form" style={{ marginBottom: 18, maxWidth: 320 }} onSubmit={handleCreateBoard}>
                  <input
                    autoFocus
                    placeholder="Board title"
                    value={newBoardTitle}
                    onChange={(e) => setNewBoardTitle(e.target.value)}
                  />
                  <button className="btn small primary" type="submit">
                    Add
                  </button>
                  <button className="btn small" type="button" onClick={() => setCreatingBoard(false)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <button className="btn primary" style={{ marginBottom: 18 }} onClick={() => setCreatingBoard(true)}>
                  + New board
                </button>
              )}

              {boardsLoading && <div className="empty-state">Loading boards…</div>}
              {!boardsLoading && boards.length === 0 && <div className="empty-state">No boards yet in this workspace.</div>}

              <div className="board-grid">
                {boards.map((board) => (
                  <div className="board-card" key={board.id}>
                    {renamingBoardId === board.id ? (
                      <div className="rename-form">
                        <input
                          autoFocus
                          value={renameBoardValue}
                          onChange={(e) => setRenameBoardValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleRenameBoard(board.id)}
                        />
                      </div>
                    ) : (
                      <div className="title">{board.title}</div>
                    )}
                    <div className="actions">
                      {renamingBoardId === board.id ? (
                        <>
                          <button className="btn small" onClick={() => handleRenameBoard(board.id)}>
                            Save
                          </button>
                          <button className="btn small" onClick={() => setRenamingBoardId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <Link className="btn small primary" to={`/board/${board.id}`}>
                            Open
                          </Link>
                          <button
                            className="btn small"
                            onClick={() => {
                              setRenamingBoardId(board.id);
                              setRenameBoardValue(board.title);
                            }}
                          >
                            Rename
                          </button>
                          <button className="btn small danger" onClick={() => handleDeleteBoard(board.id)}>
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
