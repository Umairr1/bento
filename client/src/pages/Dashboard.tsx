import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError, type Board, type SharedBoard, type Workspace } from "../api/client";
import { Menu, MoreIcon } from "../ui/Menu";
import "./Dashboard.css";

/** Sentinel workspace id for the "Shared with you" pseudo-workspace — boards you don't own. */
const SHARED_WS = -1;

/** Board tiles get a deterministic tint from their id, so a wall of boards stays scannable. */
const TINTS = ["#6d6bfa", "#e8a33d", "#3fb27f", "#f0607a", "#4aa8e0", "#b07bf0"];
const tintFor = (id: number) => TINTS[id % TINTS.length];

function relativeTime(iso: string): string {
  // SQLite's datetime('now') returns "YYYY-MM-DD HH:MM:SS" — UTC, but with no zone marker and a
  // space, which JS parses as *local* time. Left alone that makes everything look hours old the
  // moment it's created. Normalise to an explicit UTC instant first.
  const then = new Date(/Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso.replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
  const [query, setQuery] = useState("");

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
    const ws = workspaces.find((w) => w.id === id);
    if (!confirm(`Delete "${ws?.name}" and its ${ws?.boardCount ?? 0} board(s)? This can't be undone.`)) return;
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
      navigate(`/board/${board.id}`);
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
    const board = boards.find((b) => b.id === id);
    if (!confirm(`Delete "${board?.title}"? This can't be undone.`)) return;
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
  const showingShared = selectedId === SHARED_WS;

  const visibleBoards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? boards.filter((b) => b.title.toLowerCase().includes(q)) : boards;
  }, [boards, query]);

  const visibleShared = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? sharedBoards.filter((b) => b.title.toLowerCase().includes(q)) : sharedBoards;
  }, [sharedBoards, query]);

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="1" width="6.2" height="9" rx="1.4" />
              <rect x="8.8" y="1" width="6.2" height="5" rx="1.4" />
              <rect x="8.8" y="7.8" width="6.2" height="7.2" rx="1.4" />
              <rect x="1" y="11.8" width="6.2" height="3.2" rx="1.4" />
            </svg>
          </span>
          <span className="brand-name">Boards</span>
        </div>

        <Menu
          trigger={({ toggle, ref }) => (
            <button className="account-btn" ref={ref} onClick={toggle} title={user?.email}>
              <span className="avatar">{user?.name?.slice(0, 1).toUpperCase()}</span>
              <span className="account-name">{user?.name}</span>
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="menu-heading">
                <div className="menu-heading-name">{user?.name}</div>
                <div className="menu-heading-email">{user?.email}</div>
              </div>
              <hr />
              <button
                onClick={() => {
                  close();
                  logout();
                }}
              >
                Log out
              </button>
            </>
          )}
        </Menu>
      </header>

      {error && (
        <div className="dash-error" role="alert">
          {error}
          <button className="btn small ghost" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="dash-body">
        <aside className="ws-panel">
          <div className="ws-panel-head">
            <h2>Workspaces</h2>
            <button className="btn icon-btn ghost" title="New workspace" onClick={() => setCreatingWorkspace(true)}>
              +
            </button>
          </div>

          {workspacesLoading && <div className="ws-skeleton" />}

          {workspaces.map((ws) =>
            renamingWorkspaceId === ws.id ? (
              <form
                className="inline-form"
                key={ws.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRenameWorkspace(ws.id);
                }}
              >
                <input
                  className="field"
                  autoFocus
                  value={renameWorkspaceValue}
                  onChange={(e) => setRenameWorkspaceValue(e.target.value)}
                  onBlur={() => setRenamingWorkspaceId(null)}
                />
              </form>
            ) : (
              <div
                key={ws.id}
                className={`ws-item ${ws.id === selectedId ? "active" : ""}`}
                onClick={() => setSelectedId(ws.id)}
              >
                <span className="ws-name">{ws.name}</span>
                <span className="count">{ws.boardCount}</span>
                <Menu
                  trigger={({ toggle, ref }) => (
                    <button
                      className="ws-more"
                      ref={ref}
                      title="Workspace options"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle();
                      }}
                    >
                      <MoreIcon />
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      <button
                        onClick={() => {
                          close();
                          setRenamingWorkspaceId(ws.id);
                          setRenameWorkspaceValue(ws.name);
                        }}
                      >
                        Rename
                      </button>
                      <hr />
                      <button
                        className="danger"
                        onClick={() => {
                          close();
                          handleDeleteWorkspace(ws.id);
                        }}
                      >
                        Delete workspace
                      </button>
                    </>
                  )}
                </Menu>
              </div>
            )
          )}

          {creatingWorkspace && (
            <form className="inline-form" onSubmit={handleCreateWorkspace}>
              <input
                className="field"
                autoFocus
                placeholder="Workspace name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                onBlur={() => !newWorkspaceName.trim() && setCreatingWorkspace(false)}
              />
            </form>
          )}

          {!workspacesLoading && workspaces.length === 0 && !creatingWorkspace && (
            <p className="ws-empty">A workspace groups related boards. Create one to start.</p>
          )}

          {sharedBoards.length > 0 && (
            <>
              <div className="ws-divider" />
              <div className={`ws-item ${showingShared ? "active" : ""}`} onClick={() => setSelectedId(SHARED_WS)}>
                <span className="ws-name">Shared with you</span>
                <span className="count">{sharedBoards.length}</span>
              </div>
            </>
          )}
        </aside>

        <section className="boards-panel">
          {showingShared ? (
            <>
              <div className="panel-head">
                <div>
                  <h2>Shared with you</h2>
                  <p className="panel-sub">Boards other people invited you to.</p>
                </div>
                <input
                  className="field search"
                  placeholder="Search boards…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="board-grid">
                {visibleShared.map((b) => (
                  <Link className="board-card" key={b.id} to={`/board/${b.id}`}>
                    <span className="board-thumb" style={{ "--tint": tintFor(b.id) } as React.CSSProperties} />
                    <span className="board-title">{b.title}</span>
                    <span className="board-meta">
                      {b.ownerName} · {b.workspaceName}
                      <span className="role-pill">{b.role}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : !selectedWorkspace ? (
            <div className="big-empty">
              <h3>No workspace yet</h3>
              <p>Workspaces keep projects apart — one per client, or one per campaign.</p>
              <button className="btn primary" onClick={() => setCreatingWorkspace(true)}>
                Create a workspace
              </button>
            </div>
          ) : (
            <>
              <div className="panel-head">
                <div>
                  <h2>{selectedWorkspace.name}</h2>
                  <p className="panel-sub">
                    {selectedWorkspace.boardCount} {selectedWorkspace.boardCount === 1 ? "board" : "boards"}
                  </p>
                </div>
                <div className="panel-actions">
                  {boards.length > 0 && (
                    <input
                      className="field search"
                      placeholder="Search boards…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  )}
                  <button className="btn primary" onClick={() => setCreatingBoard(true)}>
                    New board
                  </button>
                </div>
              </div>

              {creatingBoard && (
                <form className="new-board-form" onSubmit={handleCreateBoard}>
                  <input
                    className="field"
                    autoFocus
                    placeholder="Board title"
                    value={newBoardTitle}
                    onChange={(e) => setNewBoardTitle(e.target.value)}
                  />
                  <button className="btn primary" type="submit">
                    Create
                  </button>
                  <button className="btn" type="button" onClick={() => setCreatingBoard(false)}>
                    Cancel
                  </button>
                </form>
              )}

              {boardsLoading && (
                <div className="board-grid">
                  {[0, 1, 2].map((i) => (
                    <div className="board-card board-card--skeleton" key={i} />
                  ))}
                </div>
              )}

              {!boardsLoading && boards.length === 0 && !creatingBoard && (
                <div className="big-empty">
                  <h3>Nothing here yet</h3>
                  <p>A board is an infinite canvas — drop in images, notes and links, then invite your team.</p>
                  <button className="btn primary" onClick={() => setCreatingBoard(true)}>
                    Create your first board
                  </button>
                </div>
              )}

              {!boardsLoading && boards.length > 0 && visibleBoards.length === 0 && (
                <div className="big-empty">
                  <h3>No matches</h3>
                  <p>Nothing in this workspace is called “{query}”.</p>
                </div>
              )}

              <div className="board-grid">
                {visibleBoards.map((board) =>
                  renamingBoardId === board.id ? (
                    <form
                      className="board-card board-card--renaming"
                      key={board.id}
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRenameBoard(board.id);
                      }}
                    >
                      <input
                        className="field"
                        autoFocus
                        value={renameBoardValue}
                        onChange={(e) => setRenameBoardValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Escape" && setRenamingBoardId(null)}
                      />
                      <div className="rename-actions">
                        <button className="btn small primary" type="submit">
                          Save
                        </button>
                        <button className="btn small" type="button" onClick={() => setRenamingBoardId(null)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <Link className="board-card" key={board.id} to={`/board/${board.id}`}>
                      <span className="board-thumb" style={{ "--tint": tintFor(board.id) } as React.CSSProperties} />
                      <span className="board-title">{board.title}</span>
                      <span className="board-meta">Created {relativeTime(board.created_at)}</span>

                      <Menu
                        trigger={({ toggle, ref }) => (
                          <button
                            className="board-more"
                            ref={ref}
                            title="Board options"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggle();
                            }}
                          >
                            <MoreIcon />
                          </button>
                        )}
                      >
                        {(close) => (
                          <>
                            <button
                              onClick={() => {
                                close();
                                setRenamingBoardId(board.id);
                                setRenameBoardValue(board.title);
                              }}
                            >
                              Rename
                            </button>
                            <hr />
                            <button
                              className="danger"
                              onClick={() => {
                                close();
                                handleDeleteBoard(board.id);
                              }}
                            >
                              Delete board
                            </button>
                          </>
                        )}
                      </Menu>
                    </Link>
                  )
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
