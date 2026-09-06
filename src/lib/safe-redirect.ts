/**
 * Reduce an untrusted `next` value to a safe, same-origin path — or `/`.
 *
 * Blocks open redirects: only a single root-relative path is accepted, never a
 * protocol-relative URL (`//evil.com`), an absolute URL, a backslash trick, or
 * the auth routes themselves (which would loop or be pointless).
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "/";

  const value = raw.trim();
  if (value.length === 0 || value.length > 512) return "/";
  if (value[0] !== "/") return "/"; // must be root-relative
  if (value[1] === "/" || value[1] === "\\") return "/"; // not protocol-relative
  if (/[\s\\]/.test(value)) return "/"; // no whitespace or backslashes

  // Reject any C0/C1 control characters.
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return "/";
  }

  const path = value.split(/[?#]/, 1)[0];
  if (path === "/login" || path === "/api" || path.startsWith("/api/")) {
    return "/";
  }

  return value;
}
