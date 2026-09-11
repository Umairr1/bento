/**
 * Where the API and the collab socket live.
 *
 * Production defaults to same-origin (an empty base → relative URLs), because the Express server
 * serves the built client: /api and /yjs are on the page's own origin. That keeps the auth cookie
 * first-party and means there is no CORS or SameSite=None configuration to get wrong.
 *
 * Set VITE_API_BASE to an absolute origin only when the client is hosted apart from the API.
 */
export const API_BASE: string =
  import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? "http://localhost:4000" : "");

/**
 * WebsocketProvider needs an absolute ws:// or wss:// URL — a relative path won't do — so the
 * same-origin case is derived from the page location rather than left blank.
 */
export function wsUrl(pathPrefix = "/yjs"): string {
  if (API_BASE) return `${API_BASE.replace(/^http/, "ws")}${pathPrefix}`;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${pathPrefix}`;
}
