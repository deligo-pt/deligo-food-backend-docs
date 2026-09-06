/** Minimal classname joiner — no dependency, truthy values only. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
