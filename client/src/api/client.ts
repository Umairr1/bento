const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export type User = { id: number; email: string; name: string };

export type Workspace = {
  id: number;
  name: string;
  owner_id: number;
  created_at: string;
  boardCount: number;
};

export type Board = {
  id: number;
  workspace_id: number;
  parent_board_id: number | null;
  title: string;
  created_by: number;
  created_at: string;
};

export type BoardWithContent = Board & { content: unknown; parentTitle: string | null };

export type LinkPreview = {
  url: string;
  title: string;
  description: string | null;
  image: string | null;
};

export function resolveAssetUrl(url: string): string {
  return url.startsWith("http") ? url : `${API_BASE}${url}`;
}

class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  signup: (email: string, password: string, name: string) =>
    request<User>("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) =>
    request<User>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  me: () => request<User>("/api/auth/me"),

  listWorkspaces: () => request<Workspace[]>("/api/workspaces"),
  createWorkspace: (name: string) =>
    request<Workspace>("/api/workspaces", { method: "POST", body: JSON.stringify({ name }) }),
  renameWorkspace: (id: number, name: string) =>
    request<Workspace>(`/api/workspaces/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteWorkspace: (id: number) => request<{ ok: true }>(`/api/workspaces/${id}`, { method: "DELETE" }),

  listBoards: (workspaceId: number) => request<Board[]>(`/api/workspaces/${workspaceId}/boards`),
  createBoard: (workspaceId: number, title: string) =>
    request<Board>(`/api/workspaces/${workspaceId}/boards`, { method: "POST", body: JSON.stringify({ title }) }),
  renameBoard: (id: number, title: string) =>
    request<Board>(`/api/boards/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
  deleteBoard: (id: number) => request<{ ok: true }>(`/api/boards/${id}`, { method: "DELETE" }),

  getBoard: (id: number) => request<BoardWithContent>(`/api/boards/${id}`),
  saveBoardContent: (id: number, content: unknown) =>
    request<{ ok: true }>(`/api/boards/${id}/content`, { method: "PUT", body: JSON.stringify({ content }) }),

  uploadFile: async (file: File): Promise<{ url: string; kind: "image" | "video" }> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/api/uploads`, { method: "POST", credentials: "include", body: form });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(body?.error ?? `Upload failed (${res.status})`);
    return body as { url: string; kind: "image" | "video" };
  },

  linkPreview: (url: string) => request<LinkPreview>(`/api/link-preview?url=${encodeURIComponent(url)}`),

  listSubboards: (id: number) => request<Board[]>(`/api/boards/${id}/subboards`),
  createSubboard: (id: number, title: string) =>
    request<Board>(`/api/boards/${id}/subboards`, { method: "POST", body: JSON.stringify({ title }) }),
};

export { ApiError };
