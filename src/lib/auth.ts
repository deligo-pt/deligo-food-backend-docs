import "server-only";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  currentAuthVersion,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session";

const encoder = new TextEncoder();

/** True when every auth environment variable is set to a usable value. */
export function authConfigured(): boolean {
  const password = process.env.DOCS_ACCESS_PASSWORD;
  const secret = process.env.DOCS_SESSION_SECRET?.trim();
  return Boolean(
    password &&
      password.length > 0 &&
      secret &&
      secret.length >= 16 &&
      currentAuthVersion() !== null,
  );
}

/**
 * Constant-time comparison of the submitted password against
 * `DOCS_ACCESS_PASSWORD`. Both sides are HMAC'd under an ephemeral key so the
 * comparison is over fixed-length digests and leaks neither length nor content.
 */
export async function checkPassword(submitted: unknown): Promise<boolean> {
  const expected = process.env.DOCS_ACCESS_PASSWORD ?? "";
  if (!expected || typeof submitted !== "string" || submitted.length === 0) {
    return false;
  }

  const key = await crypto.subtle.generateKey(
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const [a, b] = await Promise.all([
    crypto.subtle.sign("HMAC", key, encoder.encode(submitted)),
    crypto.subtle.sign("HMAC", key, encoder.encode(expected)),
  ]);

  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** The verified session for the current request, or `null`. */
export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

const cookieOptions = () =>
  ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  });

/** Issue a session cookie. Returns `false` if auth is not configured. */
export async function startSession(): Promise<boolean> {
  const token = await signSessionToken();
  if (!token) return false;
  (await cookies()).set(SESSION_COOKIE, token, {
    ...cookieOptions(),
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return true;
}

/** Clear the session cookie. */
export async function endSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}
