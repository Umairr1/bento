/**
 * The `?next=` hop used by invite links: an unauthenticated visitor opening /join/<token> gets sent
 * to log in or sign up, then back to the page they actually wanted.
 *
 * Only same-site absolute paths are honoured — anything else (a full URL, a protocol-relative
 * "//evil.com") falls back to the dashboard, so a crafted link can't turn our login page into an
 * open redirect.
 */
export function safeNext(search: string): string {
  const raw = new URLSearchParams(search).get("next");
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export function withNext(path: string, next: string): string {
  return next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`;
}
