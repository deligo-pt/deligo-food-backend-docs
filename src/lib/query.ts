/** Coerce a Next.js `searchParams` value to a single trimmed string. */
export function firstParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) return (value[0] ?? "").trim();
  return (value ?? "").trim();
}
